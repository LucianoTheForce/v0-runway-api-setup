"use server"

import { revalidatePath } from "next/cache"
import { RunwayAPI, type VideoOptions, type TaskStatus } from "@/services/runway-api"

// Armazenar tarefas em andamento
type Task = {
  id: string
  status: TaskStatus
  imageFile?: File
  imageUrl?: string
  assetId?: string
  textPrompt?: string
  options: VideoOptions
  videoUrl?: string
  error?: string
  createdAt: Date
  updatedAt: Date
  logs: string[]
  progress: number
}

// Armazenar tarefas em memória (em produção, usaríamos um banco de dados)
const tasks: Record<string, Task> = {}

// Lista de imagens de exemplo que podemos usar como fallback
const EXAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1682687982501-1e58ab814714", // Paisagem
  "https://images.unsplash.com/photo-1575936123452-b67c3203c357", // Cidade
  "https://images.unsplash.com/photo-1566275529824-cca6d008f3da", // Natureza
  "https://images.unsplash.com/photo-1595433707802-6b2626ef1c91", // Animal
  "https://images.unsplash.com/photo-1511300636408-a63a89df3482", // Praia
]

// Instância global da API do Runway
let runwayAPI: RunwayAPI | null = null

// Função para obter uma instância da API do Runway
async function getRunwayAPI(): Promise<RunwayAPI> {
  if (!runwayAPI) {
    const apiToken = process.env.USEAPI_TOKEN
    if (!apiToken) {
      throw new Error("Token de API não configurado")
    }
    runwayAPI = new RunwayAPI(apiToken)

    // Configurar a conta do Runway se as credenciais estiverem disponíveis
    const email = process.env.RUNWAY_EMAIL
    const password = process.env.RUNWAY_PASSWORD

    if (email && password) {
      try {
        await runwayAPI.setupAccount(email, password)
      } catch (error) {
        console.error("Erro ao configurar conta Runway:", error)
        // Continuar mesmo com erro, pois a API pode funcionar sem configuração explícita
      }
    }
  }
  return runwayAPI
}

// Função para adicionar log a uma tarefa
function addTaskLog(taskId: string, message: string) {
  if (tasks[taskId]) {
    tasks[taskId].logs.push(`[${new Date().toLocaleTimeString()}] ${message}`)
    tasks[taskId].updatedAt = new Date()
  }
  console.log(`[Tarefa ${taskId}] ${message}`)
}

// Função para atualizar o progresso de uma tarefa
function updateTaskProgress(taskId: string, progress: number) {
  if (tasks[taskId]) {
    tasks[taskId].progress = progress
    tasks[taskId].updatedAt = new Date()
  }
}

// Função para processar uma tarefa de geração de vídeo
async function processVideoTask(taskId: string) {
  const task = tasks[taskId]
  if (!task) return

  try {
    task.status = "processing"
    task.updatedAt = new Date()
    addTaskLog(taskId, "Iniciando processamento da tarefa")

    // Obter a instância da API do Runway
    const runwayAPI = await getRunwayAPI()

    // Fazer upload da imagem ou usar uma existente
    let assetId: string | undefined
    let usedFallback = false

    // Estratégia 1: Tentar usar a URL fornecida pelo usuário (mais confiável)
    if (task.imageUrl && !usedFallback) {
      try {
        addTaskLog(taskId, `Tentando usar a URL da imagem fornecida: ${task.imageUrl}`)
        assetId = await runwayAPI.uploadImageFromUrl(task.imageUrl)
        addTaskLog(taskId, `Upload da imagem a partir da URL concluído com sucesso. Asset ID: ${assetId}`)
      } catch (error) {
        addTaskLog(
          taskId,
          `Erro ao usar URL da imagem: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
        )
        // Continuar para a próxima estratégia
      }
    }

    // Estratégia 2: Tentar upload do arquivo do usuário
    if (!assetId && task.imageFile && !usedFallback) {
      try {
        addTaskLog(taskId, "Tentando fazer upload da imagem do usuário...")
        addTaskLog(taskId, `Tipo de arquivo: ${task.imageFile.type}, Tamanho: ${task.imageFile.size} bytes`)

        // Tentar fazer upload da imagem
        assetId = await runwayAPI.uploadImage(task.imageFile)
        addTaskLog(taskId, `Upload da imagem concluído com sucesso. Asset ID: ${assetId}`)
      } catch (error) {
        addTaskLog(
          taskId,
          `Erro ao fazer upload da imagem do usuário: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
        )
        // Continuar para a próxima estratégia
      }
    }

    // Estratégia 3: Usar uma imagem de exemplo como fallback
    if (!assetId) {
      usedFallback = true

      // Escolher uma imagem aleatória da lista
      const randomIndex = Math.floor(Math.random() * EXAMPLE_IMAGES.length)
      const exampleImageUrl = EXAMPLE_IMAGES[randomIndex]

      addTaskLog(taskId, `Usando imagem de exemplo como fallback: ${exampleImageUrl}`)

      try {
        assetId = await runwayAPI.uploadImageFromUrl(exampleImageUrl)
        task.imageUrl = exampleImageUrl // Atualizar a URL da imagem na tarefa
        addTaskLog(taskId, `Upload da imagem de exemplo concluído com sucesso. Asset ID: ${assetId}`)
      } catch (error) {
        addTaskLog(
          taskId,
          `Erro ao usar imagem de exemplo: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
        )

        // Se todas as estratégias falharem, tentar cada imagem de exemplo
        for (const url of EXAMPLE_IMAGES) {
          if (url === exampleImageUrl) continue // Pular a que já tentamos

          try {
            addTaskLog(taskId, `Tentando outra imagem de exemplo: ${url}`)
            assetId = await runwayAPI.uploadImageFromUrl(url)
            task.imageUrl = url // Atualizar a URL da imagem na tarefa
            addTaskLog(taskId, `Upload da imagem de exemplo alternativa concluído com sucesso. Asset ID: ${assetId}`)
            break
          } catch (innerError) {
            addTaskLog(
              taskId,
              `Erro ao usar imagem de exemplo alternativa: ${innerError instanceof Error ? innerError.message : "Erro desconhecido"}`,
            )
          }
        }
      }
    }

    // Se ainda não temos um asset, tentar gerar vídeo apenas com texto
    if (!assetId && task.textPrompt) {
      try {
        addTaskLog(taskId, "Não foi possível fazer upload de nenhuma imagem. Tentando gerar vídeo apenas com texto...")

        // Verificar se temos créditos suficientes
        const creditsCheck = await runwayAPI.checkCredits()
        if (!creditsCheck.hasCredits) {
          throw new Error("CREDITS_ERROR: Créditos insuficientes para executar esta tarefa.")
        }

        // Gerar vídeo apenas com texto usando Gen-4 Turbo
        const runwayTaskId = await runwayAPI.generateVideoFromText(task.textPrompt, task.options)

        // Verificar se o taskId é válido
        if (!runwayTaskId) {
          throw new Error("API retornou um ID de tarefa inválido")
        }

        addTaskLog(taskId, `Tarefa de geração de vídeo criada com ID: ${runwayTaskId}`)

        // Aguardar a conclusão da tarefa
        addTaskLog(taskId, "Aguardando conclusão da geração...")

        const result = await runwayAPI.waitForTaskCompletion(runwayTaskId, (status, progress) => {
          addTaskLog(taskId, `Status atual da geração: ${status}`)
          updateTaskProgress(taskId, progress)
        })

        if (result.status === "completed" && result.videoUrl) {
          addTaskLog(taskId, `Vídeo gerado com sucesso! URL: ${result.videoUrl}`)
          task.status = "completed"
          task.videoUrl = result.videoUrl
          task.assetId = assetId
          task.updatedAt = new Date()
          return task
        } else {
          throw new Error(result.error || "Falha na geração do vídeo")
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
        addTaskLog(taskId, `Erro ao gerar vídeo apenas com texto: ${errorMessage}`)

        // Se o erro for relacionado a créditos insuficientes, falhar a tarefa
        if (errorMessage.includes("CREDITS_ERROR")) {
          task.status = "failed"
          task.error = "Créditos insuficientes para executar esta tarefa. Por favor, verifique sua conta Runway."
          task.updatedAt = new Date()
          return task
        }

        // Continuar para o erro final
      }
    }

    // Se ainda não temos um asset, falhar a tarefa
    if (!assetId) {
      throw new Error("Não foi possível fazer upload de nenhuma imagem após várias tentativas")
    }

    // Armazenar o ID do asset
    task.assetId = assetId
    task.updatedAt = new Date()

    // Verificar se temos créditos suficientes
    const creditsCheck = await runwayAPI.checkCredits()
    if (!creditsCheck.hasCredits) {
      throw new Error("CREDITS_ERROR: Créditos insuficientes para executar esta tarefa.")
    }

    // Gerar o vídeo
    addTaskLog(taskId, "Iniciando geração de vídeo...")

    let runwayTaskId: string
    try {
      runwayTaskId = await runwayAPI.generateVideo(assetId, task.textPrompt || "", task.options)

      // Verificar se o taskId é válido
      if (!runwayTaskId) {
        throw new Error("API retornou um ID de tarefa inválido")
      }

      addTaskLog(taskId, `Tarefa de geração de vídeo criada com ID: ${runwayTaskId}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
      addTaskLog(taskId, `Erro ao criar tarefa de geração: ${errorMessage}`)

      // Se o erro for relacionado a créditos insuficientes, falhar a tarefa
      if (errorMessage.includes("CREDITS_ERROR") || errorMessage.includes("credits")) {
        task.status = "failed"
        task.error = "Créditos insuficientes para executar esta tarefa. Por favor, verifique sua conta Runway."
        task.updatedAt = new Date()
        return task
      }

      throw error
    }

    // Aguardar a conclusão da tarefa
    addTaskLog(taskId, "Aguardando conclusão da geração...")

    try {
      const result = await runwayAPI.waitForTaskCompletion(runwayTaskId, (status, progress) => {
        addTaskLog(taskId, `Status atual da geração: ${status}`)
        updateTaskProgress(taskId, progress)
      })

      if (result.status === "completed" && result.videoUrl) {
        addTaskLog(taskId, `Vídeo gerado com sucesso! URL: ${result.videoUrl}`)
        task.status = "completed"
        task.videoUrl = result.videoUrl
        task.updatedAt = new Date()
      } else {
        addTaskLog(taskId, `Erro na geração do vídeo: ${result.error}`)
        task.status = "failed"
        task.error = result.error
        task.updatedAt = new Date()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
      addTaskLog(taskId, `Erro ao aguardar conclusão da tarefa: ${errorMessage}`)
      task.status = "failed"
      task.error = errorMessage
      task.updatedAt = new Date()
    }

    return task
  } catch (error) {
    console.error(`[Tarefa ${taskId}] Erro ao processar geração de vídeo:`, error)
    task.status = "failed"
    task.error = error instanceof Error ? error.message : "Erro desconhecido ao gerar vídeo"
    task.updatedAt = new Date()
    addTaskLog(taskId, `Falha na geração: ${task.error}`)
    return task
  }
}

// Função para criar uma nova tarefa
export async function createVideoTask(formData: FormData) {
  try {
    // Extrair arquivos e opções do FormData
    const imageFiles: File[] = []
    let textPrompt = ""
    let aspectRatio = "16:9" // Valor padrão
    let seconds = 5 // Valor padrão
    let seed: number | undefined = undefined
    let exploreMode = false
    let imageUrl: string | undefined = undefined

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("image-") && value instanceof File && value.size > 0) {
        imageFiles.push(value)
      } else if (key === "image-url" && typeof value === "string" && value.trim() !== "") {
        imageUrl = value.trim()
      } else if (key === "text-prompt" && typeof value === "string") {
        textPrompt = value
      } else if (key === "aspect-ratio" && typeof value === "string") {
        aspectRatio = value
      } else if (key === "seconds" && typeof value === "string") {
        seconds = Number.parseInt(value, 10)
      } else if (key === "seed" && typeof value === "string" && value.trim() !== "") {
        seed = Number.parseInt(value, 10)
      } else if (key === "explore-mode" && value === "true") {
        exploreMode = true
      }
    }

    // Verificar se temos pelo menos uma imagem, URL ou prompt de texto
    if (imageFiles.length === 0 && !imageUrl && !textPrompt) {
      return {
        success: false,
        error: "Forneça pelo menos uma imagem, URL de imagem ou prompt de texto",
      }
    }

    // Criar ID único para a tarefa
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Criar a tarefa
    const task: Task = {
      id: taskId,
      status: "pending",
      imageFile: imageFiles.length > 0 ? imageFiles[0] : undefined,
      imageUrl,
      textPrompt,
      options: {
        aspectRatio,
        seconds,
        seed,
        exploreMode,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      logs: [],
      progress: 0,
    }

    // Armazenar a tarefa
    tasks[taskId] = task

    // Iniciar o processamento da tarefa imediatamente
    processVideoTask(taskId).catch((error) => {
      console.error(`Erro ao processar tarefa ${taskId}:`, error)

      // Atualizar a tarefa com o erro
      if (tasks[taskId]) {
        tasks[taskId].status = "failed"
        tasks[taskId].error = error instanceof Error ? error.message : "Erro desconhecido ao processar tarefa"
        tasks[taskId].updatedAt = new Date()
        addTaskLog(taskId, `Falha no processamento: ${tasks[taskId].error}`)
      }
    })

    // Revalidar a página
    revalidatePath("/")

    return {
      success: true,
      taskId,
    }
  } catch (error) {
    console.error("Erro ao criar tarefa:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao criar tarefa",
    }
  }
}

// Função para obter o status de uma tarefa
export async function getTaskStatus(taskId: string) {
  const task = tasks[taskId]
  if (!task) {
    return {
      success: false,
      error: "Tarefa não encontrada",
    }
  }

  return {
    success: true,
    task,
  }
}

// Função para obter todas as tarefas
export async function getAllTasks() {
  return {
    success: true,
    tasks: Object.values(tasks).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  }
}

// Função para verificar o saldo de créditos
export async function checkCredits() {
  try {
    const runwayAPI = await getRunwayAPI()
    return await runwayAPI.checkCredits()
  } catch (error) {
    console.error("Erro ao verificar créditos:", error)
    // Em caso de erro, retornamos que tem créditos para não bloquear o usuário
    return {
      hasCredits: true,
      error: error instanceof Error ? error.message : "Erro desconhecido ao verificar créditos",
    }
  }
}

// Função principal para processar imagens e gerar vídeo (compatibilidade com versão anterior)
export async function generateVideo(formData: FormData, logCallback?: (message: string) => void) {
  const log = (message: string) => {
    console.log(message)
    if (logCallback) {
      logCallback(message)
    }
  }

  try {
    log("Iniciando processamento das imagens...")

    // Criar uma nova tarefa
    const result = await createVideoTask(formData)

    if (!result.success) {
      log(`❌ Erro: ${result.error}`)
      return {
        success: false,
        error: result.error,
      }
    }

    const taskId = result.taskId
    log(`Tarefa criada com ID: ${taskId}`)

    // Aguardar a conclusão da tarefa (polling)
    let attempts = 0
    const maxAttempts = 60 // 5 minutos (5s * 60)

    while (attempts < maxAttempts) {
      const statusResult = await getTaskStatus(taskId)

      if (!statusResult.success) {
        log(`❌ Erro: ${statusResult.error}`)
        return {
          success: false,
          error: statusResult.error,
        }
      }

      const task = statusResult.task

      // Sincronizar logs
      task.logs.forEach((logMessage) => {
        if (!logMessage.includes("[Tarefa")) {
          log(logMessage)
        }
      })

      if (task.status === "completed") {
        log("✅ Vídeo gerado com sucesso!")
        return {
          success: true,
          videoUrl: task.videoUrl,
          usedExampleImage: !task.imageFile && !!task.imageUrl,
          exampleImageUrl: task.imageUrl,
        }
      } else if (task.status === "failed") {
        log(`❌ Erro: ${task.error}`)
        return {
          success: false,
          error: task.error,
        }
      }

      // Aguardar antes da próxima verificação
      log(`Aguardando processamento... Status atual: ${task.status} (${task.progress.toFixed(0)}%)`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      attempts++
    }

    log("❌ Tempo limite excedido ao aguardar a conclusão da tarefa")
    return {
      success: false,
      error: "Tempo limite excedido ao aguardar a conclusão da tarefa",
    }
  } catch (error) {
    console.error("Erro ao processar imagens:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao processar imagens",
    }
  }
}
