// Serviço para interagir com a API do Runway
import { v4 as uuidv4 } from "uuid"

// Tipos para as opções de vídeo
export type VideoOptions = {
  aspectRatio: string
  seconds: number
  seed?: number
  exploreMode?: boolean
  replyUrl?: string
  replyRef?: string
}

// Tipos para os status de tarefas
export type TaskStatus = "pending" | "processing" | "completed" | "failed"

// Interface para o resultado da tarefa
export interface TaskResult {
  taskId: string
  status: string
  videoUrl?: string
  error?: string
  artifacts?: Array<{ url: string; type: string }>
  progressRatio?: string | number
}

// Interface para o JWT do Runway
export interface RunwayJWT {
  id: number
  email: string
  exp: number
  iat: number
  sso: boolean
  token: string
}

// Interface para a resposta de configuração da conta
export interface AccountSetupResponse {
  email: string
  password: string
  maxJobs: number
  jwt?: RunwayJWT
  error?: string
  errorDetails?: string
  code?: number
}

// Interface para a resposta da API de geração de vídeo
export interface Gen4Response {
  taskId: string
  id?: string
  name?: string
  image?: string | null
  createdAt?: string
  updatedAt?: string
  taskType?: string
  options?: {
    name?: string
    seconds?: number
    text_prompt?: string
    seed?: number
    exploreMode?: boolean
    watermark?: boolean
    enhance_prompt?: boolean
    route?: string
    init_image?: string
    assetGroupId?: string
    assetGroupName?: string
    recordingEnabled?: boolean
  }
  status?: string
  progressText?: string
  progressRatio?: number | string
  estimatedTimeToStartSeconds?: number
  artifacts?: any[]
  sharedAsset?: any
  error?: {
    errorMessage?: string
    reason?: string
    message?: string
    moderation_category?: string
    tally_asimov?: boolean
  }
  code?: number
  replyUrl?: string
  replyRef?: string
  task?: any // Para compatibilidade com respostas aninhadas
}

// Classe principal do serviço da API
export class RunwayAPI {
  private apiToken: string
  private baseUrl = "https://api.useapi.net/v1/runwayml"
  private maxRetries = 5
  private retryDelay = 2000 // ms
  private accountConfigured = false
  private jwt: RunwayJWT | null = null

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  // Método para fazer requisições com retry automático
  private async fetchWithRetry(url: string, options: RequestInit, retries = 0): Promise<Response> {
    try {
      // Adicionar timeout para evitar requisições penduradas
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 segundos timeout

      const fetchOptions = {
        ...options,
        signal: controller.signal,
      }

      const response = await fetch(url, fetchOptions)
      clearTimeout(timeoutId)

      // Se a resposta for 429 (Too Many Requests) ou 5xx, tentar novamente
      if ((response.status === 429 || response.status >= 500) && retries < this.maxRetries) {
        // Calcular delay com backoff exponencial
        const delay = this.retryDelay * Math.pow(2, retries)
        console.log(`Recebido status ${response.status}, tentando novamente em ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.fetchWithRetry(url, options, retries + 1)
      }

      return response
    } catch (error) {
      // Se for um erro de timeout ou rede e ainda temos tentativas
      if (retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retries)
        console.log(`Erro de rede, tentando novamente em ${delay}ms...`, error)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.fetchWithRetry(url, options, retries + 1)
      }
      throw error
    }
  }

  // Método para fazer upload de uma imagem
  async uploadImage(file: File, name?: string): Promise<string> {
    // Garantir que a conta esteja configurada antes de fazer o upload
    await this.ensureAccountConfigured()

    const imageName = name || `image_${uuidv4().substring(0, 8)}`

    // Verificar se o tipo de arquivo é suportado
    const supportedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"]

    if (!supportedTypes.includes(file.type)) {
      throw new Error(`Tipo de arquivo não suportado: ${file.type}. Tipos suportados: ${supportedTypes.join(", ")}`)
    }

    // Ler o arquivo como ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    const url = `${this.baseUrl}/assets/?name=${encodeURIComponent(imageName)}`

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": file.type,
      },
      body: fileBuffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { error: errorText }
      }
      console.error("Erro na resposta da API de upload:", errorData)
      throw new Error(`Erro ao fazer upload da imagem: ${errorData.error || response.statusText}`)
    }

    const data = await response.json()
    return data.assetId
  }

  // Método para fazer upload de uma imagem a partir de uma URL
  async uploadImageFromUrl(imageUrl: string, name?: string): Promise<string> {
    // Garantir que a conta esteja configurada antes de fazer o upload
    await this.ensureAccountConfigured()

    const imageName = name || `image_${uuidv4().substring(0, 8)}`

    const url = `${this.baseUrl}/assets`

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: imageName,
        mediaType: "image",
        url: imageUrl,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { error: errorText }
      }
      console.error("Erro na resposta da API de upload:", errorData)
      throw new Error(`Erro ao fazer upload da imagem: ${errorData.error || response.statusText}`)
    }

    const data = await response.json()
    return data.assetId
  }

  // Método para gerar vídeo com Gen-4
  async generateVideo(firstImageAssetId: string, textPrompt = "", options: VideoOptions): Promise<string> {
    // Garantir que a conta esteja configurada antes de gerar o vídeo
    await this.ensureAccountConfigured()

    const url = `${this.baseUrl}/gen4/create`

    // Preparar o corpo da requisição de acordo com a documentação oficial
    const body: Record<string, any> = {
      firstImage_assetId: firstImageAssetId,
      text_prompt: textPrompt || "Generate a smooth video from this image",
      aspect_ratio: options.aspectRatio || "16:9",
      seconds: options.seconds || 5,
      maxJobs: 5,
    }

    if (options.seed) {
      body.seed = options.seed
    }

    if (options.exploreMode) {
      body.exploreMode = options.exploreMode
    }

    if (options.replyUrl) {
      body.replyUrl = options.replyUrl
    }

    if (options.replyRef) {
      body.replyRef = options.replyRef
    }

    console.log("Enviando requisição para gerar vídeo:", body)

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { error: errorText }
      }
      console.error("Erro na resposta da API de geração:", errorData)
      throw new Error(`Erro ao gerar vídeo: ${errorData.error || response.statusText}`)
    }

    const data: Gen4Response = await response.json()
    console.log("Resposta da API de geração:", JSON.stringify(data))

    // Extrair o taskId de acordo com a documentação
    let taskId: string | undefined

    // De acordo com a documentação, o taskId deve estar no nível superior
    if (data.taskId) {
      taskId = data.taskId
    }
    // Para compatibilidade com respostas aninhadas (caso observado anteriormente)
    else if (data.task && data.task.taskId) {
      taskId = data.task.taskId
    }
    // Usar o campo id como fallback apenas se não houver taskId
    else if (data.id) {
      taskId = data.id
    }

    if (!taskId) {
      console.error("API retornou resposta sem taskId:", data)
      throw new Error("API não retornou um ID de tarefa válido")
    }

    console.log(`TaskId extraído com sucesso: ${taskId}`)
    return taskId
  }

  // Método para gerar vídeo com Gen-4 Turbo (apenas texto)
  async generateVideoFromText(textPrompt: string, options: VideoOptions): Promise<string> {
    // Garantir que a conta esteja configurada antes de gerar o vídeo
    await this.ensureAccountConfigured()

    const url = `${this.baseUrl}/gen4turbo/create`

    // Preparar o corpo da requisição de acordo com a documentação
    const body: Record<string, any> = {
      text_prompt: textPrompt,
      aspect_ratio: options.aspectRatio || "16:9",
      seconds: options.seconds || 5,
      maxJobs: 5,
    }

    if (options.seed) {
      body.seed = options.seed
    }

    if (options.exploreMode) {
      body.exploreMode = options.exploreMode
    }

    if (options.replyUrl) {
      body.replyUrl = options.replyUrl
    }

    if (options.replyRef) {
      body.replyRef = options.replyRef
    }

    console.log("Enviando requisição para gerar vídeo a partir de texto:", body)

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { error: errorText }
      }
      console.error("Erro na resposta da API de geração:", errorData)
      throw new Error(`Erro ao gerar vídeo: ${errorData.error || response.statusText}`)
    }

    const data: Gen4Response = await response.json()
    console.log("Resposta da API de geração de texto:", JSON.stringify(data))

    // Extrair o taskId de acordo com a documentação
    let taskId: string | undefined

    // De acordo com a documentação, o taskId deve estar no nível superior
    if (data.taskId) {
      taskId = data.taskId
    }
    // Para compatibilidade com respostas aninhadas (caso observado anteriormente)
    else if (data.task && data.task.taskId) {
      taskId = data.task.taskId
    }
    // Usar o campo id como fallback apenas se não houver taskId
    else if (data.id) {
      taskId = data.id
    }

    if (!taskId) {
      console.error("API retornou resposta sem taskId:", data)
      throw new Error("API não retornou um ID de tarefa válido")
    }

    console.log(`TaskId extraído com sucesso: ${taskId}`)
    return taskId
  }

  // Método para verificar o status de uma tarefa
  async checkTaskStatus(taskId: string): Promise<TaskResult> {
    // Validar o taskId antes de fazer a requisição
    if (!taskId) {
      throw new Error("taskId não pode ser indefinido ou vazio")
    }

    console.log(`Verificando status da tarefa: ${taskId}`)

    // NÃO extrair o ID da tarefa - usar o taskId completo conforme recebido da API
    // A API espera o formato completo: "user:user_id-runwayml:account_email-task:task_uuid"
    const url = `${this.baseUrl}/tasks/${taskId}`

    const response = await this.fetchWithRetry(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { error: errorText }
      }
      console.error("Erro na resposta da API de status:", errorData)
      throw new Error(`Erro ao verificar status da tarefa: ${errorData.error || response.statusText}`)
    }

    const data: Gen4Response = await response.json()
    console.log("Resposta da API de status:", JSON.stringify(data))

    // Extrair informações da resposta de acordo com a documentação
    let status: string
    let videoUrl: string | undefined
    let error: string | undefined
    let artifacts: Array<{ url: string; type: string }> | undefined
    let progressRatio: string | number | undefined
    let responseTaskId: string

    // Verificar se a resposta está no formato esperado ou no formato aninhado
    if (data.task) {
      // Formato aninhado
      responseTaskId = data.task.taskId || data.task.id || taskId
      status = data.task.status || "pending"
      error = data.task.error?.errorMessage || data.task.error?.message || data.task.error
      artifacts = data.task.artifacts
      progressRatio = data.task.progressRatio

      // Verificar se há um videoUrl nos artefatos
      if (artifacts && artifacts.length > 0) {
        const videoArtifact = artifacts.find((a) => a.type === "video" || (a.url && a.url.endsWith(".mp4")))
        if (videoArtifact) {
          videoUrl = videoArtifact.url
        }
      }
    } else {
      // Formato de acordo com a documentação
      responseTaskId = data.taskId || data.id || taskId
      status = data.status || "pending"
      error =
        data.error?.errorMessage || data.error?.message || (typeof data.error === "string" ? data.error : undefined)
      artifacts = data.artifacts
      progressRatio = data.progressRatio

      // Verificar se há um videoUrl nos artefatos
      if (artifacts && artifacts.length > 0) {
        const videoArtifact = artifacts.find((a) => a.type === "video" || (a.url && a.url.endsWith(".mp4")))
        if (videoArtifact) {
          videoUrl = videoArtifact.url
        }
      }
    }

    // Normalizar o status para o formato esperado pelo nosso sistema
    let normalizedStatus = status.toLowerCase()
    if (normalizedStatus === "succeeded" || normalizedStatus === "success") {
      normalizedStatus = "completed"
    } else if (normalizedStatus === "failed" || normalizedStatus === "failure" || normalizedStatus === "canceled") {
      normalizedStatus = "failed"
    } else if (normalizedStatus === "pending" || normalizedStatus === "running" || normalizedStatus === "in_progress") {
      normalizedStatus = "processing"
    }

    return {
      taskId: responseTaskId,
      status: normalizedStatus,
      videoUrl,
      error,
      artifacts,
      progressRatio,
    }
  }

  // Método para aguardar a conclusão de uma tarefa
  async waitForTaskCompletion(
    taskId: string,
    onProgress?: (status: string, progress: number) => void,
    maxAttempts = 60,
    interval = 5000,
  ): Promise<TaskResult> {
    // Validar o taskId antes de iniciar o polling
    if (!taskId) {
      throw new Error("taskId não pode ser indefinido ou vazio")
    }

    console.log(`Aguardando conclusão da tarefa: ${taskId}`)

    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const result = await this.checkTaskStatus(taskId)

        // Calcular o progresso com base no progressRatio da API ou no número de tentativas
        let progress = (attempts / maxAttempts) * 100
        if (result.progressRatio !== undefined) {
          const ratio =
            typeof result.progressRatio === "string" ? Number.parseFloat(result.progressRatio) : result.progressRatio
          if (!isNaN(ratio)) {
            progress = ratio * 100
          }
        }

        // Chamar callback de progresso se fornecido
        if (onProgress) {
          onProgress(result.status, progress)
        }

        if (result.status === "completed") {
          return {
            ...result,
            status: "completed",
            videoUrl: result.videoUrl || result.artifacts?.[0]?.url,
          }
        } else if (result.status === "failed") {
          return {
            ...result,
            status: "failed",
          }
        }
      } catch (error) {
        console.error(`Erro ao verificar status (tentativa ${attempts + 1}/${maxAttempts}):`, error)
        // Continuar tentando mesmo com erros
      }

      // Aguardar antes da próxima verificação
      await new Promise((resolve) => setTimeout(resolve, interval))
      attempts++
    }

    // Timeout atingido
    return {
      taskId,
      status: "failed",
      error: "Tempo limite excedido ao aguardar a conclusão da tarefa",
    }
  }

  // Método para configurar uma conta do Runway
  async setupAccount(email: string, password: string): Promise<AccountSetupResponse> {
    if (!email || !password) {
      throw new Error("Email e senha são obrigatórios para configurar a conta Runway")
    }

    const url = `${this.baseUrl}/accounts/${email}`

    console.log(`Configurando conta Runway para o email: ${email}`)

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        maxJobs: 5,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Erro na resposta da API de configuração de conta:", data)
      throw new Error(`Erro ao configurar conta Runway: ${data.error || response.statusText}`)
    }

    // Armazenar o JWT para uso futuro
    if (data.jwt) {
      this.jwt = data.jwt
      this.accountConfigured = true
      console.log("Conta Runway configurada com sucesso")
    } else {
      console.warn("Aviso: Resposta da API não contém JWT")
    }

    return data
  }

  // Método para garantir que a conta esteja configurada antes de fazer chamadas à API
  private async ensureAccountConfigured(): Promise<void> {
    if (this.accountConfigured) {
      return
    }

    const email = process.env.RUNWAY_EMAIL
    const password = process.env.RUNWAY_PASSWORD

    if (!email || !password) {
      console.warn("Aviso: Credenciais do Runway não configuradas")
      return
    }

    try {
      await this.setupAccount(email, password)
    } catch (error) {
      console.error("Erro ao configurar conta Runway:", error)
      // Continuar mesmo com erro, pois a API pode funcionar sem configuração explícita
    }
  }

  // Método para verificar o saldo de créditos
  async checkCredits(): Promise<{ hasCredits: boolean; credits?: number; error?: string }> {
    try {
      // Como não há um endpoint específico para verificar créditos,
      // vamos apenas verificar se a conta está configurada corretamente
      if (this.accountConfigured && this.jwt) {
        // Se a conta estiver configurada, assumimos que tem créditos
        return { hasCredits: true }
      }

      // Tentar configurar a conta se ainda não estiver configurada
      const email = process.env.RUNWAY_EMAIL
      const password = process.env.RUNWAY_PASSWORD

      if (email && password) {
        try {
          await this.setupAccount(email, password)
          return { hasCredits: true }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          // Verificar se o erro está relacionado a créditos
          if (
            errorMessage.toLowerCase().includes("credit") ||
            errorMessage.toLowerCase().includes("insufficient") ||
            errorMessage.toLowerCase().includes("balance")
          ) {
            return { hasCredits: false, error: errorMessage }
          }
          // Se for outro tipo de erro, assumimos que tem créditos
          return { hasCredits: true, error: errorMessage }
        }
      }

      // Se não temos credenciais, assumimos que tem créditos
      return { hasCredits: true }
    } catch (error) {
      console.error("Erro ao verificar créditos:", error)
      // Em caso de erro, assumimos que tem créditos para não bloquear o usuário
      return { hasCredits: true, error: "Não foi possível verificar os créditos" }
    }
  }
}
