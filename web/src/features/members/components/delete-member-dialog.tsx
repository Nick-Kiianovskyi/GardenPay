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
import { useDeleteMember } from '@/features/members/api'
import type { Member } from '@/features/members/types'

type Props = {
  member?: Member
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

export function DeleteMemberDialog({ member, open, onOpenChange, onDeleted }: Props) {
  const deleteMember = useDeleteMember()

  const onConfirm = async () => {
    if (!member) return
    try {
      await deleteMember.mutateAsync(member.id)
      toast.success('Члена видалено')
      onOpenChange(false)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не вдалося видалити')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Видалити члена</DialogTitle>
          <DialogDescription>
            Ця дія остаточно видаляє{' '}
            {member
              ? `${member.first_name} ${member.last_name} (${member.member_no})`
              : 'обраного члена'}{' '}
            та його закріплення. Пов’язані нарахування і платежі зберігаються.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleteMember.isPending}>
            {deleteMember.isPending ? 'Видалення…' : 'Видалити члена'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}