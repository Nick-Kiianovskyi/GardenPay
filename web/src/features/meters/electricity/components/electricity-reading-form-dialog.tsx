import { useEffect, useMemo } from 'react'
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
  useCreateElectricityReading,
  usePlotOptions,
  usePreviousReading,
  useUpdateElectricityReading,
} from '@/features/meters/electricity/api'
import type { ElectricityMeterReadingRow } from '@/features/meters/electricity/types'
import {
  electricityReadingFormDefaults,
  electricityReadingFormSchema,
  type ElectricityReadingFormValues,
} from '@/validation/electricity-meter-readings'

type Props = {
  reading?: ElectricityMeterReadingRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const parseNumber = (value: string): number | null => {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

const formatKwh = (value: number): string =>
  value.toLocaleString('uk-UA', { maximumFractionDigits: 3 })

export function ElectricityReadingFormDialog({
  reading,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const isEdit = Boolean(reading)
  const create = useCreateElectricityReading()
  const update = useUpdateElectricityReading()
  const plots = usePlotOptions()

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ElectricityReadingFormValues>({
    resolver: zodResolver(electricityReadingFormSchema),
    defaultValues: electricityReadingFormDefaults(),
  })

  const [plotId, readOn, readingValue] = watch(['plot_id', 'read_on', 'reading']) as [
    string,
    string,
    string,
  ]

  const electricityMeterId = useMemo(() => {
    if (reading) return reading.electricity_meter_id
    return plots.data?.find((option) => option.plot_id === plotId)?.electricity_meter_id ?? null
  }, [reading, plots.data, plotId])

  const previous = usePreviousReading(electricityMeterId, readOn)

  useEffect(() => {
    if (open) {
      reset(
        reading
          ? {
              plot_id: reading.plot_id,
              read_on: reading.read_on,
              reading: String(reading.reading_kwh),
              note: reading.note ?? '',
            }
          : electricityReadingFormDefaults()
      )
    }
  }, [open, reading, reset])

  const current = parseNumber(readingValue)
  const hasMeter = Boolean(reading || electricityMeterId)
  const previousNumber = hasMeter ? (previous.data ?? null) : plotId ? 0 : null
  const consumption =
    current !== null && previousNumber !== null ? current - previousNumber : null

  const onSubmit = async (values: ElectricityReadingFormValues) => {
    const typed = parseNumber(values.reading) as number
    if (previousNumber !== null && typed < previousNumber) {
      setError('reading', {
        message: `Показання не можуть бути меншими за попереднє (${formatKwh(previousNumber)} кВт·год)`,
      })
      return
    }
    try {
      if (reading) {
        await update.mutateAsync({
          id: reading.id,
          electricity_meter_id: reading.electricity_meter_id,
          read_on: values.read_on,
          reading: typed,
          note: values.note || null,
        })
        toast.success('Показання оновлено')
      } else {
        await create.mutateAsync({
          plot_id: values.plot_id,
          read_on: values.read_on,
          reading: typed,
          note: values.note || null,
        })
        toast.success('Показання збережено')
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
          <DialogTitle>{isEdit ? 'Редагувати показання' : 'Додати показання'}</DialogTitle>
          <DialogDescription>
            Споживання розраховується автоматично: поточне показання мінус попереднє.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="plot">Ділянка</Label>
              <Controller
                name="plot_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    disabled={isEdit}
                  >
                    <SelectTrigger id="plot">
                      <SelectValue placeholder="Оберіть ділянку" />
                    </SelectTrigger>
                    <SelectContent>
                      {plots.data?.map((option) => (
                        <SelectItem key={option.plot_id} value={option.plot_id}>
                          {option.plot_no}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.plot_id ? (
                <p className="text-xs text-destructive">{errors.plot_id.message}</p>
              ) : null}
              {!isEdit && plots.data?.length === 0 ? (
                <p className="text-xs text-muted-foreground">Немає ділянок.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="read_on">Дата зняття</Label>
              <Input id="read_on" type="date" {...register('read_on')} />
              {errors.read_on ? (
                <p className="text-xs text-destructive">{errors.read_on.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reading">Поточне показання, кВт·год</Label>
              <Input id="reading" inputMode="decimal" placeholder="0.000" {...register('reading')} />
              {errors.reading ? (
                <p className="text-xs text-destructive">{errors.reading.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Попереднє показання</Label>
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                {previous.isPending
                  ? '…'
                  : previousNumber !== null
                    ? `${formatKwh(previousNumber)} кВт·год`
                    : '—'}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Споживання</Label>
              <div className="rounded-md border px-3 py-2 text-sm font-medium">
                {consumption !== null ? `${formatKwh(consumption)} кВт·год` : '—'}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="note">Примітка</Label>
              <Textarea id="note" rows={2} placeholder="Наприклад: замінено лічильник…" {...register('note')} />
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
              {isSubmitting ? 'Збереження…' : isEdit ? 'Зберегти зміни' : 'Додати показання'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}