import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import {
  useCreateContributionType,
  useUpdateContributionType,
} from '@/features/contribution-types/api'
import type { ContributionType, ContributionTypeWriteInput } from '@/features/contribution-types/types'
import {
  BILLING_MODES,
  CONTRIBUTION_KINDS,
  METER_KINDS,
  contributionTypeFormDefaults,
  contributionTypeFormSchema,
  contributionKindLabels,
  billingModeLabels,
  meterKindLabels,
  type ContributionTypeFormValues,
} from '@/validation/contribution-types'

type Props = {
  contribution?: ContributionType
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const toWriteInput = (values: ContributionTypeFormValues): ContributionTypeWriteInput => ({
  name: values.name,
  description: values.description || null,
  kind: values.kind,
  billing_mode: values.billing_mode,
  meter_kind: (values.meter_kind || null) as ContributionTypeWriteInput['meter_kind'],
  is_active: values.is_active,
  sort_order: 0,
})

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Помилка збереження'

export function ContributionTypeFormDialog({
  contribution,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const isEdit = Boolean(contribution)
  const create = useCreateContributionType()
  const update = useUpdateContributionType()

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContributionTypeFormValues>({
    resolver: zodResolver(contributionTypeFormSchema),
    defaultValues: contributionTypeFormDefaults(contribution),
  })

  const billingMode = watch('billing_mode')

  useEffect(() => {
    if (open) reset(contributionTypeFormDefaults(contribution))
  }, [open, contribution, reset])

  const onSubmit = async (values: ContributionTypeFormValues) => {
    try {
      if (contribution) {
        await update.mutateAsync({ id: contribution.id, ...toWriteInput(values) })
        toast.success('Вид внеску оновлено')
      } else {
        await create.mutateAsync(toWriteInput(values))
        toast.success('Вид внеску створено')
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
          <DialogTitle>{isEdit ? 'Редагувати вид внеску' : 'Створити вид внеску'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Оновити вид внеску «${contribution?.name}».`
              : 'Додати новий вид внеску (членський, вода, електроенергія, цільові тощо).'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Назва</Label>
              <Input id="name" placeholder="Членський внесок" {...register('name')} />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="kind">Вид</Label>
              <Controller
                name="kind"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRIBUTION_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {contributionKindLabels[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_mode">Спосіб нарахування</Label>
              <Controller
                name="billing_mode"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger id="billing_mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {billingModeLabels[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meter_kind">Лічильник</Label>
              <Controller
                name="meter_kind"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || '__none__'}
                    onValueChange={(value) => field.onChange(value === '__none__' ? '' : value)}
                  >
                    <SelectTrigger id="meter_kind">
                      <SelectValue placeholder="Не застосовується" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Не застосовується</SelectItem>
                      {METER_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {meterKindLabels[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.meter_kind ? (
                <p className="text-xs text-destructive">{errors.meter_kind.message}</p>
              ) : null}
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is_active"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                    />
                    <Label htmlFor="is_active" className="cursor-pointer">
                      Активний вид внеску
                    </Label>
                  </div>
                )}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Опис</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Призначення внеску…"
                {...register('description')}
              />
              {errors.description ? (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              ) : null}
            </div>
          </div>
          {billingMode === 'metered' ? (
            <p className="text-xs text-muted-foreground">
              Режим «за лічичником» потребує вибору типу лічильника (вода або електроенергія).
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Збереження…'
                : isEdit
                  ? 'Зберегти зміни'
                  : 'Створити вид внеску'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}