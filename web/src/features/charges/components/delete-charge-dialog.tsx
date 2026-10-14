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
import { useDeleteCharge } from '@/features/charges/api'
import type { ChargeRow } from '@/features/charges/types'

type Props = {
  charge: ChargeRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteChargeDialog({ charge, open, onOpenChange, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const remove = useDeleteCharge()

  const onConfirm = async () => {
    setConfirming(true)
    try {
      await remove.mutateAsync(charge.id)
      toast.success('Нарахування видалено')
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
          <DialogTitle>Видалити нарахування?</DialogTitle>
          <DialogDescription>
            Нарахування {charge.charge_no ?? charge.id.slice(0, 8)} буде видалено остаточно.
            Якщо існують пов’язані платежі, видалення неможливе.
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