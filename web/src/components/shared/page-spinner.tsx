import { Loader2 } from 'lucide-react'

export function PageSpinner({ label = 'Завантаження…' }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}