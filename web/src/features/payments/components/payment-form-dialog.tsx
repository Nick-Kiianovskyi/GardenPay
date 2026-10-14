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
import { Textarea } from '@/components/ui/textarea'
import {
  useCreatePayment,
  useOpenChargesForMember,
  usePaymentMemberOptions,
  useUpdatePayment,
} from '@/features/payments/api'
import { remainingMinor } from '@/features/payments/types'
import type { PaymentRow, PaymentWriteInput } from '@/features/payments/types'
import { majorToMinor } from '@/features/charges/business'
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  paymentFormDefaults,
  paymentFormSchema,
  paymentMethodLabels,
  paymentStatusLabels,
  type PaymentFormValues,
} from '@/validation/payments'

type Props = {
  payment?: PaymentRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  initialMemberId?: string
}

const NO_CHARGE = '__none__'

const minorToMajor = (minor: number): string => (minor / 100).toFixed(2)

export function PaymentFormDialog({ payment, open, onOpenChange, onSaved, initialMemberId }: Props) {
  const isEdit = Boolean(payment)
  const create = useCreatePayment()
  const update = useUpdatePayment()
  const members = usePaymentMemberOptions()

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: paymentFormDefaults(),
  })

  const [memberId, chargeId] = watch(['member_id', 'charge_id']) as [string, string]

  const openCharges = useOpenChargesForMember(memberId)
  const selectedCharge = openCharges.data?.find((c) => c.id === chargeId)

  useEffect(() => {
    if (open) {
      const initial: PaymentFormValues = payment
        ? {
            member_id: payment.member_id,
            charge_id: payment.charge_id ?? NO_CHARGE,
            amount: minorToMajor(payment.amount_minor),
            paid_on: payment.paid_on,
            method: payment.method as PaymentFormValues['method'],
            status: payment.status as PaymentFormValues['status'],
            reference: payment.reference ?? '',
            note: payment.note ?? '',
          }
        : {
            ...paymentFormDefaults(),
            member_id: initialMemberId ?? paymentFormDefaults().member_id,
          }
      reset(initial)
    }
  }, [open, payment, reset, initialMemberId])

  // partial payment: default amount to the remaining balance of the chosen charge
  useEffect(() => {
    if (selectedCharge && !isEdit) {
      setValue('amount', minorToMajor(remainingMinor(selectedCharge)))
    }
  }, [selectedCharge, isEdit, setValue])

  const onSubmit = async (values: PaymentFormValues) => {
    const charge = openCharges.data?.find((c) => c.id === values.charge_id)
    if (charge) {
      const amountMinor = majorToMinor(values.amount)
      const remaining = remainingMinor(charge)
      if (amountMinor > remaining) {
        setError('amount', {
          message: `Сума перевищує залишок рахунку (${minorToMajor(remaining)} ₴)`,
        })
        return
      }
    }
    const payload: PaymentWriteInput = {
      member_id: values.member_id,
      charge_id: values.charge_id === NO_CHARGE || values.charge_id === '' ? null : values.charge_id,
      amount_minor: majorToMinor(values.amount),
      kind: 'payment',
      method: values.method,
      status: values.status,
      paid_on: values.paid_on,
      reference: values.reference || null,
      note: values.note || null,
    }
    try {
      if (payment) {
        await update.mutateAsync({ id: payment.id, ...payload })
        toast.success('Платіж оновлено')
      } else {
        await create.mutateAsync(payload)
        toast.success('Платіж збережено')
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка збереження')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редагувати платіж' : 'Новий платіж'}</DialogTitle>
          <DialogDescription>
            Часткові платежі підтримуються: сума може бути меншою за залишок рахунку. Кілька
            платежів можна вносити поступово.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="member">Член</Label>
              <Controller
                name="member_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || ''}
                    onValueChange={(value) => {
                      field.onChange(value)
                      if (!isEdit) setValue('charge_id', '')
                    }}
                  >
                    <SelectTrigger id="member">
                      <SelectValue placeholder="Оберіть члена" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.data?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.last_name}, {m.first_name} ({m.member_no})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.member_id ? (
                <p className="text-xs text-destructive">{errors.member_id.message}</p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="charge">Рахунок (за послугою)</Label>
              <Controller
                name="charge_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger id="charge">
                      <SelectValue placeholder="Оберіть рахунок або залиште без прив’язки" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CHARGE}>Без прив’язки до рахунку</SelectItem>
                      {openCharges.data?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.charge_no ?? '—'} · {c.contribution_types?.name ?? 'послуга'} ·{' '}
                          {c.plots ? `ділянка ${c.plots.plot_no} · ` : ''}залишок{' '}
                          {minorToMajor(remainingMinor(c))} ₴
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {memberId && openCharges.isFetched && openCharges.data?.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Відкритих рахунків у члена немає — платіж буде збережено як аванс (без прив’язки).
                </p>
              ) : null}
              {errors.charge_id ? (
                <p className="text-xs text-destructive">{errors.charge_id.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Сума, ₴</Label>
              <Input id="amount" inputMode="decimal" placeholder="0.00" {...register('amount')} />
              {errors.amount ? (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              ) : null}
              {selectedCharge ? (
                <p className="text-xs text-muted-foreground">
                  Залишок за рахунком: {minorToMajor(remainingMinor(selectedCharge))} ₴
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paid_on">Дата платежу</Label>
              <Input id="paid_on" type="date" {...register('paid_on')} />
              {errors.paid_on ? (
                <p className="text-xs text-destructive">{errors.paid_on.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Спосіб оплати</Label>
              <Controller
                name="method"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {paymentMethodLabels[method]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
                      {PAYMENT_STATUSES.filter((s) => s !== 'void').map((status) => (
                        <SelectItem key={status} value={status}>
                          {paymentStatusLabels[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reference">Референс (номер квитанції / банку)</Label>
              <Input id="reference" placeholder="Необов’язково" {...register('reference')} />
              {errors.reference ? (
                <p className="text-xs text-destructive">{errors.reference.message}</p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="note">Примітка</Label>
              <Textarea id="note" rows={2} placeholder="Необов’язково" {...register('note')} />
              {errors.note ? (
                <p className="text-xs text-destructive">{errors.note.message}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Збереження…' : isEdit ? 'Зберегти зміни' : 'Зберегти платіж'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}