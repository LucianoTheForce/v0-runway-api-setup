"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { EXAMPLE_IMAGES } from "@/utils/demo-assets"

interface ExampleImagesGalleryProps {
  onSelectImage: (imageUrl: string) => void
  disabled?: boolean
}

export function ExampleImagesGallery({ onSelectImage, disabled = false }: ExampleImagesGalleryProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  const handleSelectImage = (index: number) => {
    setSelectedImageIndex(index)
  }

  const handleConfirmSelection = () => {
    if (selectedImageIndex !== null) {
      onSelectImage(EXAMPLE_IMAGES[selectedImageIndex])
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Imagens de exemplo</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {EXAMPLE_IMAGES.map((imageUrl, index) => (
          <div
            key={index}
            className={`relative aspect-square overflow-hidden rounded-md cursor-pointer border-2 ${
              selectedImageIndex === index ? "border-blue-500" : "border-transparent"
            }`}
            onClick={() => !disabled && handleSelectImage(index)}
          >
            <Image
              src={imageUrl || "/placeholder.svg"}
              alt={`Exemplo ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100px, 150px"
            />
          </div>
        ))}
      </div>
      {selectedImageIndex !== null && (
        <div className="flex justify-end">
          <Button onClick={handleConfirmSelection} disabled={disabled}>
            Usar esta imagem
          </Button>
        </div>
      )}
    </div>
  )
}
