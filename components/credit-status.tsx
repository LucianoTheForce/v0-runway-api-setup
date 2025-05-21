"use client"

import { useEffect, useState } from "react"
import { checkCredits } from "@/app/actions"
import { AlertCircle, CheckCircle, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function CreditStatus() {
  const [status, setStatus] = useState<{
    loading: boolean
    hasCredits?: boolean
    credits?: number
    error?: string
    accountConfigured?: boolean
  }>({
    loading: true,
  })

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const result = await checkCredits()
        setStatus({
          loading: false,
          hasCredits: result.hasCredits,
          credits: result.credits,
          error: result.error,
          accountConfigured: true,
        })
      } catch (error) {
        console.error("Erro ao verificar status dos créditos:", error)
        // Em caso de erro, não exibimos nada
        setStatus({
          loading: false,
          accountConfigured: false,
          error: error instanceof Error ? error.message : "Erro desconhecido ao verificar créditos",
        })
      }
    }

    fetchCredits()
  }, [])

  if (status.loading) {
    return null
  }

  // Se houver um erro na verificação, exibir um alerta informativo
  if (status.error && !status.hasCredits) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Possível problema com créditos</AlertTitle>
        <AlertDescription>
          {status.error.includes("credit") || status.error.includes("insufficient")
            ? "Sua conta Runway pode não ter créditos suficientes para gerar vídeos."
            : "Houve um problema ao verificar o status da sua conta Runway."}
        </AlertDescription>
      </Alert>
    )
  }

  // Se não conseguimos verificar a conta, exibir um alerta informativo
  if (!status.accountConfigured) {
    return (
      <Alert className="mb-4">
        <Info className="h-4 w-4" />
        <AlertTitle>Status da conta</AlertTitle>
        <AlertDescription>
          Não foi possível verificar o status da sua conta Runway. O sistema tentará usar as credenciais fornecidas
          quando necessário.
        </AlertDescription>
      </Alert>
    )
  }

  // Se tudo estiver ok, exibir um alerta positivo
  return (
    <Alert className="mb-4 bg-green-50 border-green-200">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertTitle className="text-green-800">Conta Runway configurada</AlertTitle>
      <AlertDescription className="text-green-700">
        Sua conta Runway está configurada e pronta para gerar vídeos.
        {status.credits !== undefined && ` Você possui ${status.credits} créditos disponíveis.`}
      </AlertDescription>
    </Alert>
  )
}
