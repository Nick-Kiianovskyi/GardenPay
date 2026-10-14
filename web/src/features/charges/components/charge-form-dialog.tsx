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
import {
  useChargePlotOptions,
  useChargeServiceOptions,
  useCreateCharge,
  useMemberOptions,
  usePlotElectricityReadings,
  usePlotWaterReadings,
  useTariffsForType,
  type ElectricityReadingOption,
  type WaterReadingOption,
} from '@/features/charges/api'
import { chargeAmountMinor, majorToMinor, minorToMajor, sotkaQuantity, tariffAtDate } from '@/features/charges/business'
import type { ChargeRole, ChargeWriteInput } from '@/features/charges/types'
import {
  chargeFormDefaults,
  chargeFormSchema,
  type ChargeFormValues,
} from '@/validation/charges'
import { unitLabels } from '@/validation/tariffs'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const roleOf = (kind?: string): ChargeRole => {
  if (kind === 'membership_fee' || kind === 'plot_rent') return 'membership'
  if (kind === 'water' || kind === 'electricity') return 'meter'
  return 'manual'
}

const roleDescription: Record<ChargeRole, string> = {
  membership: 'Членський внесок: площа × тариф за сотку',
  meter: 'Споживання × тариф на дату показання',
  manual: 'Ручна сума (без тарифу)',
}

const schemeLabel = (kind?: string): string => {
  switch (kind) {
    case 'membership_fee':
      return 'членський внесок'
    case 'plot_rent':
      return 'оренда ділянки'
    case 'water':
      return 'вода'
    case 'electricity':
      return 'електроенергія'
    case 'penalty':
      return 'штраф / пеня'
    case 'one_time':
      return 'цільовий внесок'
    default:
      return 'інше'
  }
}

export function ChargeFormDialog({ open, onOpenChange, onSaved }: Props) {
  const createCharge = useCreateCharge()
  const services = useChargeServiceOptions()
  const plots = useChargePlotOptions()
  const members = useMemberOptions()

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChargeFormValues>({
    resolver: zodResolver(chargeFormSchema),
    defaultValues: chargeFormDefaults(),
  })

  const [contributionTypeId, plotId, readingId, manualAmount] = watch([
    'contribution_type_id',
    'plot_id',
    'reading_id',
    'manual_amount',
  ]) as [string, string, string, string]

  const service = services.data?.find((s) => s.id === contributionTypeId)
  const mode = roleOf(service?.kind)

  const waterReadings = usePlotWaterReadings(mode === 'meter' && service?.kind === 'water' ? plotId : '')
  const electricityReadings = usePlotElectricityReadings(
    mode === 'meter' && service?.kind === 'electricity' ? plotId : ''
  )
  const readings =
    service?.kind === 'water'
      ? (waterReadings.data ?? [])
      : service?.kind === 'electricity'
        ? (electricityReadings.data ?? [])
        : []
  const reading = readings.find((r) => r.id === readingId)

  const tariffs = useTariffsForType(contributionTypeId)
  const plot = plots.data?.find((p) => p.id === plotId)

  // auto-fill member from the plot owner
  useEffect(() => {
    if (mode !== 'manual' && plot && plot.members) {
      setValue('member_id', plot.members.id)
    }
  }, [plot, mode, setValue])

  // when kind is not manual and not meter-driven, clear a stale reading
  useEffect(() => {
    if (mode !== 'meter') setValue('reading_id', '')
  }, [mode, setValue])

  useEffect(() => {
    if (open) reset(chargeFormDefaults())
  }, [open, reset])

  const currentReadingId = mode === 'meter' ? readingId : ''

  const billing = useMemo(() => {
    if (mode === 'membership') {
      if (!plot) return null
      const tariff = tariffAtDate(tariffs.data ?? [], todayIso())
      if (!tariff) return null
      const quantity = sotkaQuantity(plot.area_m2)
      return {
        quantity,
        unit: tariff.unit,
        unitPriceMinor: tariff.amount_minor,
        tariff,
        amountMinor: chargeAmountMinor(quantity, tariff.amount_minor),
        periodTo: null,
      }
    }
    if (mode === 'meter') {
      if (!reading) return null
      const unit = service?.kind === 'water' ? ('m3' as const) : ('kwh' as const)
      const tariff = tariffAtDate(tariffs.data ?? [], reading.read_on, unit)
      if (!tariff) return null
      const quantity =
        service?.kind === 'water'
          ? (reading as WaterReadingOption).consumption_m3
          : (reading as ElectricityReadingOption).consumption_kwh
      return {
        quantity,
        unit: tariff.unit,
        unitPriceMinor: tariff.amount_minor,
        tariff,
        amountMinor: chargeAmountMinor(quantity, tariff.amount_minor),
        periodTo: reading.read_on,
      }
    }
    if (mode === 'manual') {
      const minor = manualAmount ? majorToMinor(manualAmount) : 0
      return {
        quantity: 1,
        unit: 'fixed' as const,
        unitPriceMinor: minor,
        tariff: undefined,
        amountMinor: minor,
        periodTo: null,
      }
    }
    return null
  }, [mode, plot, reading, tariffs.data, service?.kind, manualAmount])

  const onSubmit = async (values: ChargeFormValues) => {
    if (mode === 'membership' && !values.plot_id) {
      setError('plot_id', { message: 'Оберіть ділянку' })
      return
    }
    if (mode === 'membership' && !values.member_id) {
      setError('member_id', { message: 'Для ділянки не вказано власника — оберіть члена' })
      return
    }
    if (mode === 'meter' && !values.plot_id) {
      setError('plot_id', { message: 'Оберіть ділянку' })
      return
    }
    if (mode === 'meter' && !currentReadingId) {
      setError('reading_id', { message: 'Оберіть показання' })
      return
    }
    if (mode === 'manual' && !values.member_id) {
      setError('member_id', { message: 'Оберіть члена' })
      return
    }
    if (mode === 'manual' && !values.manual_amount) {
      setError('manual_amount', { message: 'Вкажіть суму' })
      return
    }
    if (!billing) {
      if (mode === 'membership') {
        toast.error('Немає дійсного тарифу для послуги «членський внесок»')
      } else if (mode === 'meter') {
        toast.error('Немає дійсного тарифу на дату показання')
      }
      return
    }
    if (mode === 'meter' && !values.member_id) {
      setError('member_id', { message: 'Для ділянки не вказано власника — оберіть члена' })
      return
    }

    const r = mode === 'meter' ? readings?.find((x) => x.id === currentReadingId) : undefined
    const payload: ChargeWriteInput = {
      member_id: values.member_id,
      plot_id: mode === 'manual' ? null : values.plot_id || null,
      contribution_type_id: values.contribution_type_id,
      tariff_id: billing.tariff?.id ?? null,
      water_meter_reading_id: service?.kind === 'water' ? (r?.id ?? null) : null,
      electricity_meter_reading_id: service?.kind === 'electricity' ? (r?.id ?? null) : null,
      period_from: null,
      period_to: billing.periodTo,
      quantity: billing.quantity,
      unit: billing.unit,
      unit_price_minor: billing.unitPriceMinor,
      due_on: values.due_on,
      note: values.note || null,
    }
    try {
      await createCharge.mutateAsync(payload)
      toast.success('Нарахування створено')
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка створення нарахування')
    }
  }

  const previewNumeric = (value: number): string =>
    value.toLocaleString('uk-UA', { maximumFractionDigits: 3 })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Нове нарахування</DialogTitle>
          <DialogDescription>{roleDescription[mode]}</DialogDescription>
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
                      {services.data?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {s.is_active ? '' : '(неактивна)'}
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

            {mode === 'membership' ? (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="plot">Ділянка</Label>
                  <Controller
                    name="plot_id"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger id="plot">
                          <SelectValue placeholder="Оберіть ділянку" />
                        </SelectTrigger>
                        <SelectContent>
                          {plots.data?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.plot_no} · {(p.area_m2).toLocaleString('uk-UA')} м²
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.plot_id ? (
                    <p className="text-xs text-destructive">{errors.plot_id.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member">Член (власник)</Label>
                  <Controller
                    name="member_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        disabled={Boolean(plot?.members)}
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
                  {plot && !plot.members ? (
                    <p className="text-xs text-muted-foreground">
                      Ділянка без власника — оберіть члена вручну.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Площа</Label>
                  <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    {plot
                      ? `${sotkaQuantity(plot.area_m2).toLocaleString('uk-UA', { maximumFractionDigits: 3 })} соток (${plot.area_m2.toLocaleString('uk-UA')} м²)`
                      : '—'}
                  </div>
                </div>
              </>
            ) : null}

            {mode === 'meter' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="plot">Ділянка</Label>
                  <Controller
                    name="plot_id"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger id="plot">
                          <SelectValue placeholder="Оберіть ділянку" />
                        </SelectTrigger>
                        <SelectContent>
                          {plots.data?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.plot_no}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.plot_id ? (
                    <p className="text-xs text-destructive">{errors.plot_id.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reading">Показання (дата · спожито)</Label>
                  <Controller
                    name="reading_id"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger id="reading">
                          <SelectValue placeholder="Оберіть показання" />
                        </SelectTrigger>
                        <SelectContent>
                          {readings?.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.read_on} ·{' '}
                              {service?.kind === 'water'
                                ? (r as WaterReadingOption).consumption_m3
                                : (r as ElectricityReadingOption).consumption_kwh}{' '}
                              {service?.kind === 'water' ? 'м³' : 'кВт·год'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.reading_id ? (
                    <p className="text-xs text-destructive">{errors.reading_id.message}</p>
                  ) : null}
                  {plotId && readings?.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Показань для ділянки немає — спершу додайте їх у журналі лічильників.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="member">Член (власник ділянки)</Label>
                  <Controller
                    name="member_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                        disabled={Boolean(plot?.members)}
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
              </>
            ) : null}

            {mode === 'manual' ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="member">Член</Label>
                <Controller
                  name="member_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
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
            ) : null}

            {mode === 'manual' ? (
              <div className="space-y-2">
                <Label htmlFor="amount">Сума, ₴</Label>
                <Input id="amount" inputMode="decimal" placeholder="0.00" {...register('manual_amount')} />
                {errors.manual_amount ? (
                  <p className="text-xs text-destructive">{errors.manual_amount.message}</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="due_on">Термін оплати</Label>
              <Input id="due_on" type="date" {...register('due_on')} />
              {errors.due_on ? (
                <p className="text-xs text-destructive">{errors.due_on.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Примітка</Label>
              <Input id="note" placeholder="Необов’язково" {...register('note')} />
              {errors.note ? (
                <p className="text-xs text-destructive">{errors.note.message}</p>
              ) : null}
            </div>
          </div>

          {billing ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Розрахунок — {schemeLabel(service?.kind)}</p>
              <p className="mt-1 text-muted-foreground">
                Обсяг: {previewNumeric(billing.quantity)}{' '}
                {unitLabels[billing.unit] ?? billing.unit} × {minorToMajor(billing.unitPriceMinor)} ₴ ={' '}
                <span className="font-semibold text-foreground">
                  {minorToMajor(billing.amountMinor)} ₴
                </span>
              </p>
              {billing.tariff ? (
                <p className="text-xs text-muted-foreground">
                  Тариф «{billing.tariff.name}» — знімок наказання (діє з {billing.tariff.valid_from}
                  {billing.tariff.valid_to ? ` по ${billing.tariff.valid_to}` : ', безстроково'})
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Без тарифу — ручна сума (знімок у збереженні).
                </p>
              )}
            </div>
          ) : mode === 'membership' || mode === 'meter' ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              Оберіть ділянку/показання — для розрахунку потрібен дійсний тариф.
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Збереження…' : 'Створити нарахування'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}