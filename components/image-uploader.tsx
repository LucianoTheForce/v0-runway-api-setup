"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { generateVideo, getTaskStatus } from "@/app/actions"
import { Loader2, Upload, X, Download, AlertCircle, Info, Settings, History, ImageIcon } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Adicionar os imports dos novos componentes
import { DirectImageUpload } from "@/components/direct-image-upload"
import { ExampleImagesGallery } from "@/components/example-images-gallery"
// Adicionar o import do componente de compartilhamento
import { ShareVideo } from "@/components/share-video"

// Tamanho máximo da imagem em bytes (2MB)
const MAX_IMAGE_SIZE = 2 * 1024 * 1024

export function ImageUploader() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [textPrompt, setTextPrompt] = useState("")
  const [usedExampleImage, setUsedExampleImage] = useState(false)
  const [exampleImageUrl, setExampleImageUrl] = useState<string | null>(null)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [aspectRatio, setAspectRatio] = useState("16:9")
  const [seconds, setSeconds] = useState("5")
  const [seed, setSeed] = useState("")
  const [exploreMode, setExploreMode] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [activeTab, setActiveTab] = useState("upload")
  const videoRef = useRef<HTMLVideoElement>(null)
  const { toast } = useToast()

  // Limpar o intervalo de polling quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Verificar tamanho da imagem
      const file = e.target.files[0]
      if (file.size > MAX_IMAGE_SIZE) {
        toast({
          title: "Imagem muito grande",
          description: `O tamanho máximo permitido é ${MAX_IMAGE_SIZE / (1024 * 1024)}MB. Sua imagem tem ${(
            file.size / (1024 * 1024)
          ).toFixed(2)}MB.`,
          variant: "destructive",
        })
        return
      }

      // Limitar a apenas uma imagem por enquanto, já que apenas a primeira é usada
      const newFiles = [file]
      setFiles(newFiles)
      setPreviews([]) // Limpar previews anteriores
      setImageUrl("") // Limpar URL da imagem

      // Create previews
      newFiles.forEach((file) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            setPreviews((prev) => [...prev, e.target!.result as string])
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
    // Rolar para o último log
    setTimeout(() => {
      const consoleElement = document.getElementById("console-logs")
      if (consoleElement) {
        consoleElement.scrollTop = consoleElement.scrollHeight
      }
    }, 100)
  }

  // Função para verificar o status da tarefa periodicamente
  const startPolling = (taskId: string) => {
    // Limpar qualquer intervalo existente
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    // Iniciar novo intervalo
    const interval = setInterval(async () => {
      try {
        const result = await getTaskStatus(taskId)
        if (result.success) {
          const task = result.task

          // Atualizar progresso
          setProgress(task.progress)

          // Sincronizar logs
          task.logs.forEach((logMessage) => {
            if (!logs.includes(logMessage)) {
              addLog(logMessage.replace(/^\[\d+:\d+:\d+\] /, ""))
            }
          })

          // Verificar se a tarefa foi concluída ou falhou
          if (task.status === "completed") {
            setIsUploading(false)
            setProgress(100)
            setVideoUrl(task.videoUrl || null)
            setIsVideoLoading(true)

            // Verificar se usamos uma imagem de exemplo
            if (!files.length && task.imageUrl) {
              setUsedExampleImage(true)
              setExampleImageUrl(task.imageUrl)
              addLog("⚠️ Usamos uma imagem de exemplo devido a problemas com o upload da sua imagem")
            }

            addLog("✅ Vídeo gerado com sucesso!")
            toast({
              title: "Vídeo gerado com sucesso!",
              description: usedExampleImage
                ? "Usamos uma imagem de exemplo devido a problemas com o upload da sua imagem."
                : "Seu vídeo está pronto para visualização e download.",
            })

            // Parar o polling
            clearInterval(interval)
            setPollingInterval(null)
          } else if (task.status === "failed") {
            setIsUploading(false)
            setVideoError(task.error || "Ocorreu um erro desconhecido")
            addLog(`❌ Erro: ${task.error || "Ocorreu um erro desconhecido"}`)
            toast({
              title: "Erro ao gerar vídeo",
              description: task.error || "Ocorreu um erro ao processar suas imagens.",
              variant: "destructive",
            })

            // Parar o polling
            clearInterval(interval)
            setPollingInterval(null)
          }
        }
      } catch (error) {
        console.error("Erro ao verificar status da tarefa:", error)
      }
    }, 2000) // Verificar a cada 2 segundos

    setPollingInterval(interval)
  }

  const handleSubmit = async () => {
    if (files.length === 0 && !imageUrl && !textPrompt) {
      toast({
        title: "Nenhuma entrada fornecida",
        description: "Por favor, forneça pelo menos uma imagem, URL de imagem ou prompt de texto para gerar o vídeo.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setProgress(0)
    setLogs([])
    setVideoUrl(null)
    setVideoError(null)
    setUsedExampleImage(false)
    setExampleImageUrl(null)
    addLog("Iniciando processo de geração de vídeo...")

    if (textPrompt) {
      addLog(`Prompt de texto: "${textPrompt}"`)
    } else {
      addLog("Nenhum prompt de texto fornecido")
    }

    addLog(
      `Configurações: Proporção ${aspectRatio}, Duração ${seconds}s${seed ? `, Seed ${seed}` : ""}${exploreMode ? ", Modo Exploração ativado" : ""}`,
    )

    try {
      // Create FormData to send files
      const formData = new FormData()

      // Adicionar informações detalhadas sobre os arquivos
      files.forEach((file, index) => {
        formData.append(`image-${index}`, file)
        addLog(`Preparando imagem ${index + 1}: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)} KB)`)
      })

      // Adicionar URL da imagem se fornecida
      if (imageUrl) {
        formData.append("image-url", imageUrl)
        addLog(`Usando URL da imagem: ${imageUrl}`)
      }

      // Adicionar o prompt de texto e opções de configuração
      formData.append("text-prompt", textPrompt)
      formData.append("aspect-ratio", aspectRatio)
      formData.append("seconds", seconds)
      if (seed) formData.append("seed", seed)
      if (exploreMode) formData.append("explore-mode", "true")

      addLog(`Total de ${files.length} imagens preparadas para upload`)

      // Call server action to process images and generate video
      addLog("Enviando dados para processamento...")
      const result = await generateVideo(formData, addLog)

      if (result.success) {
        // Armazenar o ID da tarefa para polling
        if (result.taskId) {
          setCurrentTaskId(result.taskId)
          startPolling(result.taskId)
          addLog(`Tarefa iniciada com ID: ${result.taskId}`)
        } else if (result.videoUrl) {
          // Caso de resposta imediata (improvável)
          setIsUploading(false)
          setProgress(100)
          setVideoUrl(result.videoUrl)
          setIsVideoLoading(true)

          // Verificar se usamos uma imagem de exemplo
          if (result.usedExampleImage) {
            setUsedExampleImage(true)
            setExampleImageUrl(result.exampleImageUrl)
            addLog("⚠️ Usamos uma imagem de exemplo devido a problemas com o upload da sua imagem")
          }

          addLog("✅ Vídeo gerado com sucesso!")
          toast({
            title: "Vídeo gerado com sucesso!",
            description: result.usedExampleImage
              ? "Usamos uma imagem de exemplo devido a problemas com o upload da sua imagem."
              : "Seu vídeo está pronto para visualização e download.",
          })
        }
      } else {
        setIsUploading(false)
        setVideoError(result.error || "Ocorreu um erro desconhecido")
        addLog(`❌ Erro: ${result.error || "Ocorreu um erro desconhecido"}`)
        toast({
          title: "Erro ao gerar vídeo",
          description: result.error || "Ocorreu um erro ao processar suas imagens.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error uploading images:", error)
      setIsUploading(false)
      addLog(`❌ Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
      toast({
        title: "Erro no upload",
        description: "Ocorreu um erro ao fazer upload das imagens.",
        variant: "destructive",
      })
    }
  }

  const handleVideoError = () => {
    setIsVideoLoading(false)
    setVideoError("Erro ao carregar o vídeo. Verifique a URL ou tente novamente.")
    addLog("❌ Erro ao carregar o vídeo")
  }

  const handleVideoLoad = () => {
    setIsVideoLoading(false)
    addLog("Vídeo carregado com sucesso")
  }

  // Dentro do componente ImageUploader, adicionar uma nova função para lidar com o upload direto
  const handleDirectImageUploaded = (imageUrl: string) => {
    setImageUrl(imageUrl)
    toast({
      title: "Imagem enviada com sucesso",
      description: "A URL da imagem foi adicionada ao formulário.",
    })
  }

  // Função para lidar com a seleção de uma imagem de exemplo
  const handleExampleImageSelected = (imageUrl: string) => {
    setImageUrl(imageUrl)
    setFiles([]) // Limpar arquivos de upload
    setPreviews([]) // Limpar previews
    toast({
      title: "Imagem de exemplo selecionada",
      description: "A imagem de exemplo foi selecionada com sucesso.",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Alert className="bg-yellow-50 border-yellow-200 flex-1">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Integração com Runway Gen-4</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Esta aplicação usa a API Gen-4 do Runway para gerar vídeos a partir de imagens. Selecione uma imagem e
            opcionalmente forneça um prompt de texto para guiar a geração.
          </AlertDescription>
        </Alert>
        <Link href="/historico" className="ml-4 flex items-center text-blue-600 hover:underline">
          <History className="h-4 w-4 mr-1" />
          Ver histórico
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="upload" disabled={isUploading}>
            <Upload className="h-4 w-4 mr-2" />
            Upload de Arquivo
          </TabsTrigger>
          <TabsTrigger value="url" disabled={isUploading}>
            <ImageIcon className="h-4 w-4 mr-2" />
            URL de Imagem
          </TabsTrigger>
          <TabsTrigger value="examples" disabled={isUploading}>
            <Info className="h-4 w-4 mr-2" />
            Imagens de Exemplo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Clique para fazer upload</span> ou arraste e solte
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG ou JPEG (máx. {MAX_IMAGE_SIZE / (1024 * 1024)}MB)
                </p>
              </div>
              <Input
                id="image-upload"
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>
          </div>

          <div className="text-center my-4">
            <p className="text-sm text-gray-500">ou</p>
          </div>

          <div className="border-t border-b py-4">
            <h3 className="text-sm font-medium mb-2">Upload direto para Imgur (mais confiável)</h3>
            <DirectImageUpload onImageUploaded={handleDirectImageUploaded} disabled={isUploading} />
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="image-url">URL da imagem</Label>
            <Input
              id="image-url"
              type="url"
              placeholder="https://exemplo.com/imagem.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-gray-500">
              Forneça uma URL de imagem pública. A imagem deve estar acessível publicamente.
            </p>
          </div>

          {imageUrl && (
            <div className="mt-4 p-4 border rounded-lg">
              <h3 className="text-sm font-medium mb-2">Prévia da imagem</h3>
              <div className="aspect-video relative bg-gray-100 rounded-lg overflow-hidden">
                <Image
                  src={imageUrl || "/placeholder.svg"}
                  alt="Prévia da imagem"
                  fill
                  className="object-contain"
                  onError={() => {
                    toast({
                      title: "Erro ao carregar imagem",
                      description: "Não foi possível carregar a imagem a partir da URL fornecida.",
                      variant: "destructive",
                    })
                  }}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <ExampleImagesGallery onSelectImage={handleExampleImageSelected} disabled={isUploading} />
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="text-prompt" className="text-sm font-medium">
              Prompt de Texto {files.length === 0 && !imageUrl && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              id="text-prompt"
              placeholder={
                files.length === 0 && !imageUrl
                  ? "Descreva o vídeo que você quer gerar (obrigatório quando não há imagem)"
                  : "Descreva como você quer que o vídeo seja gerado..."
              }
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              disabled={isUploading}
              className="resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-500">
              {files.length === 0 && !imageUrl
                ? "Sem imagem, um prompt de texto é obrigatório para gerar o vídeo usando Gen-4 Turbo."
                : "Descreva o que você quer ver no vídeo. O Runway usará esta descrição para guiar a geração."}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <Settings className="w-4 h-4 mr-1" />
                {showAdvancedOptions ? "Ocultar opções avançadas" : "Mostrar opções avançadas"}
              </button>
            </div>

            {showAdvancedOptions && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="aspect-ratio">Proporção do Vídeo</Label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger id="aspect-ratio">
                      <SelectValue placeholder="Selecione a proporção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Paisagem)</SelectItem>
                      <SelectItem value="9:16">9:16 (Retrato)</SelectItem>
                      <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                      <SelectItem value="4:3">4:3</SelectItem>
                      <SelectItem value="3:4">3:4</SelectItem>
                      <SelectItem value="21:9">21:9 (Ultrawide)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seconds">Duração (segundos)</Label>
                  <Select value={seconds} onValueChange={setSeconds}>
                    <SelectTrigger id="seconds">
                      <SelectValue placeholder="Selecione a duração" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 segundos</SelectItem>
                      <SelectItem value="10">10 segundos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seed">Seed (opcional)</Label>
                  <Input
                    id="seed"
                    type="number"
                    placeholder="Número entre 1 e 4294967294"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    min="1"
                    max="4294967294"
                  />
                  <p className="text-xs text-gray-500">
                    Controla a aleatoriedade da geração. Use o mesmo valor para resultados consistentes.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="explore-mode">Modo Exploração</Label>
                    <Switch id="explore-mode" checked={exploreMode} onCheckedChange={setExploreMode} />
                  </div>
                  <p className="text-xs text-gray-500">
                    Disponível apenas para contas com plano Unlimited. Não consome créditos.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {previews.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {previews.map((preview, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square overflow-hidden rounded-lg">
                    <Image
                      src={preview || "/placeholder.svg"}
                      alt={`Preview ${index + 1}`}
                      width={200}
                      height={200}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isUploading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 text-center">
                    Imagem de Referência
                  </div>
                </div>
              ))}
            </div>
          )}

          {imageUrl && files.length === 0 && activeTab !== "url" && (
            <div className="relative group">
              <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
                <Image
                  src={imageUrl || "/placeholder.svg"}
                  alt="Imagem de URL"
                  width={300}
                  height={300}
                  className="object-contain"
                  onError={() => {
                    toast({
                      title: "Erro ao carregar imagem",
                      description: "Não foi possível carregar a imagem a partir da URL fornecida.",
                      variant: "destructive",
                    })
                  }}
                />
              </div>
              <button
                onClick={() => setImageUrl("")}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Processando...</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium flex items-center">
            <span className="mr-2">Console</span>
            <span
              className={`h-2 w-2 rounded-full ${
                isUploading || isVideoLoading ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`}
            ></span>
          </h3>
          <div
            id="console-logs"
            className="bg-black text-green-400 p-3 rounded-md h-40 overflow-y-auto font-mono text-xs"
          >
            {logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {usedExampleImage && exampleImageUrl && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Imagem de exemplo usada</AlertTitle>
          <AlertDescription className="text-blue-700">
            Devido a problemas com o upload da sua imagem, usamos uma imagem de exemplo para gerar o vídeo.
            <div className="mt-2 aspect-square w-full max-w-xs overflow-hidden rounded-lg mx-auto">
              <Image
                src={exampleImageUrl || "/placeholder.svg"}
                alt="Imagem de exemplo usada"
                width={200}
                height={200}
                className="object-cover w-full h-full"
              />
            </div>
          </AlertDescription>
        </Alert>
      )}

      {videoUrl && !isUploading && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">Vídeo Gerado</h3>

          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {isVideoLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
            ) : videoError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <p className="text-red-400 mb-2">{videoError}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setVideoError(null)
                    setIsVideoLoading(true)
                    if (videoRef.current) {
                      videoRef.current.load()
                    }
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <video
                ref={videoRef}
                controls
                className="w-full h-full"
                onLoadStart={() => setIsVideoLoading(true)}
                onCanPlay={handleVideoLoad}
                onError={handleVideoError}
              >
                <source src={videoUrl} type="video/mp4" />
                Seu navegador não suporta a reprodução de vídeos.
              </video>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <ShareVideo videoUrl={videoUrl} title={textPrompt || "Vídeo gerado com Runway AI"} />
            <Button asChild className="flex items-center gap-2">
              <a href={videoUrl} download="runway-video.mp4">
                <Download className="h-4 w-4" />
                Download do Vídeo
              </a>
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isUploading || (files.length === 0 && !imageUrl && !textPrompt)}>
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando
            </>
          ) : (
            "Gerar Vídeo"
          )}
        </Button>
      </div>
    </div>
  )
}
