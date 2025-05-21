"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Share, Copy, Check, Twitter, Facebook, Linkedin, LinkIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ShareVideoProps {
  videoUrl: string
  title?: string
}

export function ShareVideo({ videoUrl, title = "Vídeo gerado com Runway AI" }: ShareVideoProps) {
  const [isCopied, setIsCopied] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  const handleCopyLink = () => {
    navigator.clipboard.writeText(videoUrl)
    setIsCopied(true)
    toast({
      title: "Link copiado!",
      description: "O link do vídeo foi copiado para a área de transferência.",
    })
    setTimeout(() => setIsCopied(false), 2000)
  }

  const shareOnTwitter = () => {
    const text = encodeURIComponent(`${title} ${videoUrl}`)
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank")
    setIsOpen(false)
  }

  const shareOnFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(videoUrl)}`, "_blank")
    setIsOpen(false)
  }

  const shareOnLinkedIn = () => {
    const text = encodeURIComponent(title)
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(videoUrl)}&title=${text}`,
      "_blank",
    )
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share className="h-4 w-4" />
          Compartilhar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar vídeo</DialogTitle>
          <DialogDescription>Compartilhe este vídeo nas redes sociais ou copie o link direto.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-10 w-10"
              onClick={shareOnTwitter}
              title="Compartilhar no Twitter"
            >
              <Twitter className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-10 w-10"
              onClick={shareOnFacebook}
              title="Compartilhar no Facebook"
            >
              <Facebook className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-10 w-10"
              onClick={shareOnLinkedIn}
              title="Compartilhar no LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="link" className="sr-only">
              Link
            </Label>
            <div className="flex items-center gap-2">
              <div className="grid flex-1 gap-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-gray-400" />
                  <Input id="link" defaultValue={videoUrl} readOnly className="h-9" />
                </div>
              </div>
              <Button type="submit" size="sm" className="px-3 gap-1" onClick={handleCopyLink}>
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isCopied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
