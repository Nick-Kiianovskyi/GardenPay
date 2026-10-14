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
import { useDeletePayment } from '@/features/payments/api'
import type { PaymentRow } from '@/features/payments/types'
import { minorToMajor } from '@/features/charges/business'

type Props = {
  payment: PaymentRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeletePaymentDialog({ payment, open, onOpenChange, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const remove = useDeletePayment()

  const onConfirm = async () => {
    setConfirming(true)
    try {
      await remove.mutateAsync(payment.id)
      toast.success('Платіж видалено')
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
          <DialogTitle>Видалити платіж?</DialogTitle>
          <DialogDescription>
            Платіж {payment.reference ?? ''} на суму {minorToMajor(payment.amount_minor)} ₴ від{' '}
            {payment.paid_on} буде видалено. Залишок і статус рахунку буде перераховано
            автоматично.
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