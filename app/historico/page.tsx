import { getAllTasks } from "@/app/actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Progress } from "@/components/ui/progress"

export default async function HistoricoPage() {
  const { success, tasks, error } = await getAllTasks()

  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-4xl font-bold text-center mb-8">Histórico de Vídeos Gerados</h1>

      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Voltar para o gerador
        </Link>
      </div>

      {!success ? (
        <div className="text-center text-red-500">{error || "Erro ao carregar histórico"}</div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-gray-500">Nenhum vídeo foi gerado ainda.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <Card key={task.id} className="overflow-hidden">
              <div className="aspect-video relative bg-gray-100">
                {task.status === "completed" && task.videoUrl ? (
                  <video src={task.videoUrl} className="w-full h-full object-cover" controls poster={task.imageUrl} />
                ) : task.imageUrl ? (
                  <Image
                    src={task.imageUrl || "/placeholder.svg"}
                    alt="Imagem de referência"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">Sem prévia</div>
                )}
                <div className="absolute top-2 right-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      task.status === "completed"
                        ? "bg-green-500 text-white"
                        : task.status === "failed"
                          ? "bg-red-500 text-white"
                          : task.status === "processing"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-500 text-white"
                    }`}
                  >
                    {task.status === "completed"
                      ? "Concluído"
                      : task.status === "failed"
                        ? "Falhou"
                        : task.status === "processing"
                          ? "Processando"
                          : "Pendente"}
                  </span>
                </div>
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-lg">
                  {task.textPrompt
                    ? task.textPrompt.length > 50
                      ? task.textPrompt.substring(0, 50) + "..."
                      : task.textPrompt
                    : "Vídeo sem prompt"}
                </CardTitle>
                <CardDescription>
                  Criado {formatDistanceToNow(new Date(task.createdAt), { locale: ptBR, addSuffix: true })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-sm text-gray-500">
                  <p>
                    Proporção: {task.options.aspectRatio} • Duração: {task.options.seconds}s
                  </p>
                  {task.error && (
                    <p className="text-red-500 mt-2">
                      Erro: {task.error.length > 100 ? task.error.substring(0, 100) + "..." : task.error}
                    </p>
                  )}
                </div>

                {task.status === "processing" && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Progresso</span>
                      <span>{task.progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={task.progress} className="h-1.5" />
                  </div>
                )}

                {task.logs && task.logs.length > 0 && (
                  <Accordion type="single" collapsible className="mt-4">
                    <AccordionItem value="logs">
                      <AccordionTrigger className="text-sm">Ver logs ({task.logs.length})</AccordionTrigger>
                      <AccordionContent>
                        <div className="bg-gray-100 p-2 rounded-md max-h-40 overflow-y-auto text-xs font-mono">
                          {task.logs.map((log, index) => (
                            <div key={index} className="whitespace-pre-wrap">
                              {log}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
                {task.status === "completed" && task.videoUrl && (
                  <div className="mt-4">
                    <a
                      href={task.videoUrl}
                      download="runway-video.mp4"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Download do vídeo
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
