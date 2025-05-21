"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Upload, X } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"

// Tamanho máximo da imagem em bytes (2MB)
const MAX_IMAGE_SIZE = 2 * 1024 * 1024

interface DirectImageUploadProps {
  onImageUploaded: (imageUrl: string) => void
  disabled?: boolean
}

export function DirectImageUpload({ onImageUploaded, disabled = false }: DirectImageUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Verificar tamanho da imagem
      const selectedFile = e.target.files[0]
      if (selectedFile.size > MAX_IMAGE_SIZE) {
        toast({
          title: "Imagem muito grande",
          description: `O tamanho máximo permitido é ${MAX_IMAGE_SIZE / (1024 * 1024)}MB. Sua imagem tem ${(
            selectedFile.size / (1024 * 1024)
          ).toFixed(2)}MB.`,
          variant: "destructive",
        })
        return
      }

      // Verificar tipo de arquivo
      const supportedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
      if (!supportedTypes.includes(selectedFile.type)) {
        toast({
          title: "Tipo de arquivo não suportado",
          description: `Apenas ${supportedTypes.join(", ")} são suportados.`,
          variant: "destructive",
        })
        return
      }

      setFile(selectedFile)

      // Criar preview
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          setPreview(e.target.result as string)
        }
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  const removeFile = () => {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const uploadToImgur = async () => {
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Criar um FormData para enviar a imagem
      const formData = new FormData()
      formData.append("image", file)

      // Usar XMLHttpRequest para monitorar o progresso
      const xhr = new XMLHttpRequest()

      // Configurar evento de progresso
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(progress)
        }
      })

      // Configurar promessa para aguardar a conclusão
      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText)
                if (response.success && response.data && response.data.link) {
                  resolve(response.data.link)
                } else {
                  reject(new Error("Resposta inválida do servidor"))
                }
              } catch (error) {
                reject(new Error("Erro ao analisar resposta do servidor"))
              }
            } else {
              reject(new Error(`Erro ${xhr.status}: ${xhr.statusText}`))
            }
          }
        }

        xhr.onerror = () => reject(new Error("Erro de rede ao fazer upload"))
        xhr.ontimeout = () => reject(new Error("Timeout ao fazer upload"))
      })

      // Configurar e enviar a requisição
      xhr.open("POST", "https://api.imgur.com/3/image", true)
      xhr.setRequestHeader("Authorization", "Client-ID 546c25a59c58ad7") // Imgur API Client ID
      xhr.timeout = 30000 // 30 segundos
      xhr.send(formData)

      // Aguardar a conclusão do upload
      const imageUrl = await uploadPromise

      // Notificar o componente pai
      onImageUploaded(imageUrl)

      toast({
        title: "Upload concluído",
        description: "Sua imagem foi enviada com sucesso!",
      })

      // Limpar o formulário
      removeFile()
    } catch (error) {
      console.error("Erro ao fazer upload:", error)
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao fazer upload da imagem.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="direct-image-upload"
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
            id="direct-image-upload"
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading || disabled}
          />
        </label>
      </div>

      {preview && (
        <div className="relative group">
          <div className="aspect-square overflow-hidden rounded-lg max-w-xs mx-auto">
            <Image
              src={preview || "/placeholder.svg"}
              alt="Preview da imagem"
              width={200}
              height={200}
              className="object-cover w-full h-full"
            />
          </div>
          <button
            onClick={removeFile}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={isUploading || disabled}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {file && (
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">
            {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </p>
          <Button onClick={uploadToImgur} disabled={isUploading || disabled}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando... {uploadProgress}%
              </>
            ) : (
              "Fazer upload"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
