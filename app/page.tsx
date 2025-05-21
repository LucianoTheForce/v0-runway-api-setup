import { ImageUploader } from "@/components/image-uploader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RecentTasks } from "@/components/recent-tasks"
import { CreditStatus } from "@/components/credit-status"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-4xl font-bold text-center mb-8">Gerador de Vídeos com Runway AI</h1>

      <CreditStatus />

      <Card className="max-w-5xl mx-auto mb-10">
        <CardHeader>
          <CardTitle>Upload de Imagens</CardTitle>
          <CardDescription>Faça upload de imagens para gerar um vídeo usando Runway AI</CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUploader />
        </CardContent>
      </Card>

      <div className="max-w-5xl mx-auto mt-12">
        <RecentTasks />
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Esta é uma demonstração de integração com a API do Runway.</p>
        <p>Faça upload de imagens e veja o processo de geração de vídeo em tempo real.</p>
      </div>
    </main>
  )
}
