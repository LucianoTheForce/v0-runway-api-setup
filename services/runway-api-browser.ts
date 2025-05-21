// Versão alternativa do serviço de API do Runway otimizada para o navegador
import { v4 as uuidv4 } from "uuid"

// Tipos para as opções de vídeo
export type VideoOptions = {
  aspectRatio: string
  seconds: number
  seed?: number
  exploreMode?: boolean
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
}

// Classe principal do serviço da API
export class RunwayAPIBrowser {
  private apiToken: string
  private baseUrl = "https://api.useapi.net/v1/runwayml"
  private maxRetries = 5
  private retryDelay = 2000 // ms

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

  // Método para fazer upload de uma imagem usando fetch diretamente
  async uploadImage(file: File, name?: string): Promise<string> {
    const imageName = name || `image_${uuidv4().substring(0, 8)}`

    // Verificar se o tipo de arquivo é suportado
    const supportedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"]

    if (!supportedTypes.includes(file.type)) {
      throw new Error(`Tipo de arquivo não suportado: ${file.type}. Tipos suportados: ${supportedTypes.join(", ")}`)
    }

    // Criar URL para upload
    const url = `${this.baseUrl}/assets/?name=${encodeURIComponent(imageName)}`

    // Usar XMLHttpRequest para ter mais controle sobre o upload
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.open("POST", url, true)
      xhr.setRequestHeader("Authorization", `Bearer ${this.apiToken}`)
      xhr.setRequestHeader("Content-Type", file.type)

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response.assetId)
          } catch (e) {
            reject(new Error(`Erro ao analisar resposta: ${xhr.responseText}`))
          }
        } else {
          let errorMessage = `Erro ${xhr.status}: ${xhr.statusText}`
          try {
            const errorData = JSON.parse(xhr.responseText)
            errorMessage = errorData.error || errorMessage
          } catch (e) {
            // Ignorar erro de parsing
          }
          reject(new Error(errorMessage))
        }
      }

      xhr.onerror = () => {
        reject(new Error("Erro de rede ao fazer upload da imagem"))
      }

      xhr.ontimeout = () => {
        reject(new Error("Timeout ao fazer upload da imagem"))
      }

      xhr.timeout = 30000 // 30 segundos

      // Enviar o arquivo diretamente
      xhr.send(file)
    })
  }

  // Método para fazer upload de uma imagem a partir de uma URL
  async uploadImageFromUrl(imageUrl: string, name?: string): Promise<string> {
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
    const url = `${this.baseUrl}/gen4/create`

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

    const data = await response.json()
    return data.taskId
  }

  // Método para gerar vídeo com Gen-4 Turbo (apenas texto)
  async generateVideoFromText(textPrompt: string, options: VideoOptions): Promise<string> {
    const url = `${this.baseUrl}/gen4turbo/create`

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

    const data = await response.json()
    return data.taskId
  }

  // Método para verificar o status de uma tarefa
  async checkTaskStatus(taskId: string): Promise<TaskResult> {
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

    const data = await response.json()

    return {
      taskId: data.taskId,
      status: data.status,
      videoUrl: data.videoUrl,
      error: data.errorMessage,
      artifacts: data.artifacts,
    }
  }

  // Método para aguardar a conclusão de uma tarefa
  async waitForTaskCompletion(
    taskId: string,
    onProgress?: (status: string, progress: number) => void,
    maxAttempts = 60,
    interval = 5000,
  ): Promise<TaskResult> {
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const result = await this.checkTaskStatus(taskId)

        // Chamar callback de progresso se fornecido
        if (onProgress) {
          onProgress(result.status, (attempts / maxAttempts) * 100)
        }

        if (result.status === "completed" || result.status === "SUCCEEDED") {
          return {
            ...result,
            status: "completed",
            videoUrl: result.videoUrl || result.artifacts?.[0]?.url,
          }
        } else if (result.status === "failed" || result.status === "FAILED" || result.status === "CANCELED") {
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
  async setupAccount(email: string, password: string): Promise<any> {
    const url = `${this.baseUrl}/accounts/${email}`

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

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { error: errorText }
      }
      console.error("Erro na resposta da API de configuração de conta:", errorData)
      throw new Error(`Erro ao configurar conta Runway: ${errorData.error || response.statusText}`)
    }

    return response.json()
  }
}
