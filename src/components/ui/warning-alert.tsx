import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

interface WarningAlertProps {
  duplicateQuestions?: number
  duplicateProposals?: number
  onDismiss?: () => void
}

export function WarningAlert({
  duplicateQuestions = 0,
  duplicateProposals = 0,
  onDismiss
}: WarningAlertProps) {
  if (duplicateQuestions === 0 && duplicateProposals === 0) {
    return null
  }

  const messages: string[] = []
  if (duplicateQuestions > 0) {
    messages.push(`${duplicateQuestions}件の重複した質問`)
  }
  if (duplicateProposals > 0) {
    messages.push(`${duplicateProposals}件の重複した提案`)
  }

  return (
    <Alert variant="warning" className="relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>重複した提案が検出されました</AlertTitle>
      <AlertDescription>
        {messages.join("、")}が既存の提案と重複しています。
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 text-sm underline hover:no-underline"
          >
            閉じる
          </button>
        )}
      </AlertDescription>
    </Alert>
  )
}
