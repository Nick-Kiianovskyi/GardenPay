import { useState } from 'react'
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
import { useDeleteWaterReading } from '@/features/meters/water/api'
import type { WaterMeterReadingRow } from '@/features/meters/water/types'

type Props = {
  reading: WaterMeterReadingRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteWaterReadingDialog({ reading, open, onOpenChange, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const remove = useDeleteWaterReading()

  const onConfirm = async () => {
    setConfirming(true)
    try {
      await remove.mutateAsync(reading.id)
      toast.success('Показання видалено')
      onOpenChange(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка видалення')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Видалити показання?</DialogTitle>
          <DialogDescription>
            Показання для ділянки {reading.plot_no} за {reading.read_on} буде видалено з журналу.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button variant="destructive" disabled={confirming} onClick={onConfirm}>
            {confirming ? 'Видалення…' : 'Видалити'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}