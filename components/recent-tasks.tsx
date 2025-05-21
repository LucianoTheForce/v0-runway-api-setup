"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getAllTasks } from "@/app/actions"

// Tipo para as tarefas
type Task = {
  id: string
  status: "pending" | "processing" | "completed" | "failed"
  imageUrl?: string
  textPrompt?: string
  videoUrl?: string
  error?: string
  createdAt: Date
  updatedAt: Date
  progress: number
}

export function RecentTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = async () => {
    try {
      const result = await getAllTasks()
      if (result.success) {
        setTasks(result.tasks.slice(0, 3)) // Mostrar apenas as 3 tarefas mais recentes
      } else {
        setError("Erro ao carregar tarefas recentes")
      }
    } catch (err) {
      setError("Erro ao carregar tarefas recentes")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()

    // Atualizar a cada 10 segundos
    const interval = setInterval(fetchTasks, 10000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <p>Carregando tarefas recentes...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>{error}</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>Nenhuma tarefa recente encontrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Tarefas Recentes</h2>
        <Link href="/historico" className="text-blue-600 hover:underline text-sm">
          Ver todas
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tasks.map((task) => (
          <Card key={task.id} className="overflow-hidden">
            <div className="aspect-video relative bg-gray-100">
              {task.status === "completed" && task.videoUrl ? (
                <video
                  src={task.videoUrl}
                  className="w-full h-full object-cover"
                  controls
                  muted
                  poster={task.imageUrl}
                />
              ) : task.imageUrl ? (
                <Image
                  src={task.imageUrl || "/placeholder.svg"}
                  alt="Imagem de referência"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100%, 33vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">Sem prévia</div>
              )}
              <div className="absolute top-2 right-2">
                <Badge
                  className={
                    task.status === "completed"
                      ? "bg-green-500"
                      : task.status === "failed"
                        ? "bg-red-500"
                        : task.status === "processing"
                          ? "bg-blue-500"
                          : "bg-gray-500"
                  }
                >
                  {task.status === "completed"
                    ? "Concluído"
                    : task.status === "failed"
                      ? "Falhou"
                      : task.status === "processing"
                        ? "Processando"
                        : "Pendente"}
                </Badge>
              </div>
            </div>
            <CardHeader className="p-3">
              <CardTitle className="text-sm">
                {task.textPrompt
                  ? task.textPrompt.length > 30
                    ? task.textPrompt.substring(0, 30) + "..."
                    : task.textPrompt
                  : "Vídeo sem prompt"}
              </CardTitle>
              <CardDescription className="text-xs">
                {formatDistanceToNow(new Date(task.createdAt), { locale: ptBR, addSuffix: true })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {task.status === "processing" && (
                <div className="space-y-1">
                  <Progress value={task.progress} className="h-1.5" />
                  <p className="text-xs text-gray-500 text-right">{task.progress.toFixed(0)}%</p>
                </div>
              )}
              {task.status === "completed" && task.videoUrl && (
                <div className="flex justify-end space-x-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={task.videoUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Ver
                    </a>
                  </Button>
                  <Button size="sm" variant="default" asChild>
                    <a href={task.videoUrl} download="runway-video.mp4">
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  </Button>
                </div>
              )}
              {task.status === "failed" && (
                <p className="text-xs text-red-500">
                  {task.error && task.error.length > 50 ? task.error.substring(0, 50) + "..." : task.error}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
