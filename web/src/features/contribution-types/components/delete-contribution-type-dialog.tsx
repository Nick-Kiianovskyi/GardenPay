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
import { useDeleteContributionType } from '@/features/contribution-types/api'
import type { ContributionType } from '@/features/contribution-types/types'

type Props = {
  contribution: ContributionType
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteContributionTypeDialog({ contribution, open, onOpenChange, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false)
  const remove = useDeleteContributionType()

  const onConfirm = async () => {
    setConfirming(true)
    try {
      await remove.mutateAsync(contribution.id)
      toast.success('Вид внеску видалено')
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
          <DialogTitle>Видалити вид внеску «{contribution.name}»?</DialogTitle>
          <DialogDescription>
            Вид внеску буде видалено остаточно. Пов’язані тарифи також буде видалено
            (каскадно).
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