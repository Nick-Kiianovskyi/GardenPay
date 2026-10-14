import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDeletePlot } from '@/features/plots/api'
import type { Plot } from '@/features/plots/types'

type Props = {
  plot?: Plot
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeletePlotDialog({ plot, open, onOpenChange, onDeleted }: Props) {
  const deletePlot = useDeletePlot()

  const onConfirm = async () => {
    if (!plot) return
    try {
      await deletePlot.mutateAsync(plot.id)
      toast.success('Ділянку видалено')
      onOpenChange(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка видалення')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Видалити ділянку</DialogTitle>
          <DialogDescription>
            Це остаточно видалить ділянку {plot ? `«${plot.plot_no}»` : '…'} разом із призначеннями.
            Історія нарахувань і платежів зберігається.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deletePlot.isPending}>
            {deletePlot.isPending ? 'Видалення…' : 'Видалити ділянку'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}