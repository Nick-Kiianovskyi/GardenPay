import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateMember, useUpdateMember } from '@/features/members/api'
import {
  memberFormDefaults,
  memberFormSchema,
  MEMBER_KIND_LABELS,
  MEMBER_STATUS_LABELS,
  MEMBER_KINDS,
  MEMBER_STATUSES,
  type MemberFormValues,
} from '@/validation/members'
import type { Member, MemberWriteInput } from '@/features/members/types'

type Props = {
  member?: Member
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const toWriteInput = (values: MemberFormValues): MemberWriteInput => ({
  member_no: values.member_no,
  first_name: values.first_name,
  last_name: values.last_name,
  email: values.email || null,
  phone: values.phone || null,
  kind: values.kind,
  status: values.status,
  joined_on: values.joined_on,
  left_on: values.left_on || null,
})

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Не вдалося зберегти'

export function MemberFormDialog({ member, open, onOpenChange, onSaved }: Props) {
  const isEdit = Boolean(member)
  const createMember = useCreateMember()
  const updateMember = useUpdateMember()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: memberFormDefaults(member),
  })

  useEffect(() => {
    if (open) reset(memberFormDefaults(member))
  }, [open, member, reset])

  const onSubmit = async (values: MemberFormValues) => {
    try {
      if (member) {
        await updateMember.mutateAsync({ id: member.id, ...toWriteInput(values) })
        toast.success('Члена оновлено')
      } else {
        await createMember.mutateAsync(toWriteInput(values))
        toast.success('Члена створено')
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редагувати члена' : 'Створити члена'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Оновлення ${member?.member_no} — зміни одразу доступні користувачам із правом читання.`
              : 'Додайте нового члена до реєстру.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="member_no">№ члена</Label>
              <Input id="member_no" placeholder="M-0001" {...register('member_no')} />
              {errors.member_no ? (
                <p className="text-xs text-destructive">{errors.member_no.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {MEMBER_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="first_name">Ім’я</Label>
              <Input id="first_name" {...register('first_name')} />
              {errors.first_name ? (
                <p className="text-xs text-destructive">{errors.first_name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Прізвище</Label>
              <Input id="last_name" {...register('last_name')} />
              {errors.last_name ? (
                <p className="text-xs text-destructive">{errors.last_name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="name@example.com" {...register('email')} />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" placeholder="+380…" {...register('phone')} />
              {errors.phone ? (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="kind">Тип</Label>
              <Controller
                name="kind"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {MEMBER_KIND_LABELS[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joined_on">Дата вступу</Label>
              <Input id="joined_on" type="date" {...register('joined_on')} />
              {errors.joined_on ? (
                <p className="text-xs text-destructive">{errors.joined_on.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="left_on">Дата виходу</Label>
              <Input id="left_on" type="date" {...register('left_on')} />
              {errors.left_on ? (
                <p className="text-xs text-destructive">{errors.left_on.message}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Збереження…' : isEdit ? 'Зберегти зміни' : 'Створити члена'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}