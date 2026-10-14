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
import { useCreateTariff, useServiceOptions, useUpdateTariff } from '@/features/tariffs/api'
import type { Tariff, TariffWriteInput } from '@/features/tariffs/types'
import {
  TARIFF_UNITS,
  tariffFormDefaults,
  tariffFormSchema,
  unitLabels,
  type TariffFormValues,
} from '@/validation/tariffs'
import { todayIso } from '@/validation/members'

type Props = {
  tariff?: Tariff
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function TariffFormDialog({ tariff, open, onOpenChange, onSaved }: Props) {
  const isEdit = Boolean(tariff)
  const createTariff = useCreateTariff()
  const updateTariff = useUpdateTariff()
  const services = useServiceOptions()

  const prefill = tariff
    ? {
        contribution_type_id: tariff.contribution_type_id,
        unit: tariff.unit,
        valid_from: tariff.valid_from,
        valid_to: tariff.valid_to,
        rate: String(tariff.amount_minor / 100)
      }
    : undefined

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TariffFormValues>({
    resolver: zodResolver(tariffFormSchema),
    defaultValues: tariffFormDefaults(undefined),
  })

  useEffect(() => {
    if (open) {
      reset(
        tariff
          ? { ...tariffFormDefaults(prefill), rate: String(tariff.amount_minor / 100) }
          : { ...tariffFormDefaults(), valid_from: todayIso() }
      )
    }
  }, [open, tariff]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values: TariffFormValues) => {
    try {
      const service = services.data?.find((s) => s.id === values.contribution_type_id)
      const input: TariffWriteInput = {
        contribution_type_id: values.contribution_type_id,
        name: service?.name ?? values.contribution_type_id,
        unit: values.unit,
        amount_minor: Math.round(Number(values.rate.replace(',', '.')) * 100),
        valid_from: values.valid_from,
        valid_to: values.valid_to || null,
      }
      if (tariff) {
        await updateTariff.mutateAsync({ id: tariff.id, ...input })
        toast.success('Тариф оновлено')
      } else {
        await createTariff.mutateAsync(input)
        toast.success('Тариф створено')
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
          <DialogTitle>{isEdit ? 'Редагувати тариф' : 'Створити тариф'}</DialogTitle>
          <DialogDescription>
            Тарифи зберігають історію цін; дійсний тариф визначається автоматично за датою.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="service">Послуга (вид внеску)</Label>
              <Controller
                name="contribution_type_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger id="service">
                      <SelectValue placeholder="Оберіть послугу" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.data?.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                          {service.is_active ? '' : ' (неактивна)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.contribution_type_id ? (
                <p className="text-xs text-destructive">{errors.contribution_type_id.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Тариф, ₴</Label>
              <Input id="rate" inputMode="decimal" placeholder="0.00" {...register('rate')} />
              {errors.rate ? <p className="text-xs text-destructive">{errors.rate.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Одиниця</Label>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARIFF_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unitLabels[unit]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valid_from">Діє з</Label>
              <Input id="valid_from" type="date" {...register('valid_from')} />
              {errors.valid_from ? (
                <p className="text-xs text-destructive">{errors.valid_from.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="valid_to">Діє до (порожньо — безстроково)</Label>
              <Input id="valid_to" type="date" {...register('valid_to')} />
              {errors.valid_to ? (
                <p className="text-xs text-destructive">{errors.valid_to.message}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isSubmitting || services.isPending}>
              {isSubmitting ? 'Збереження…' : isEdit ? 'Зберегти зміни' : 'Створити тариф'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}