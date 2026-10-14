import { useMemo, useState } from 'react'
import { Calculator, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { FINANCE_ROLES } from '@/config/navigation'
import { Can } from '@/features/auth/guards'
import {
  useActiveAccrualPlots,
  useMassAccrualServiceOptions,
  usePreviewMassAccrual,
  useSaveMassAccrual,
} from '@/features/charges/api'
import { majorToMinor, minorToMajor } from '@/features/charges/business'
import {
  massRowToCharge,
  type MassAccrualResult,
  type MassAccrualService,
} from '@/features/charges/mass-accrual'
import { unitLabels } from '@/validation/tariffs'
import { billingModeLabels } from '@/validation/contribution-types'

const pad = (value: number): string => String(value).padStart(2, '0')

const toIso = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const startOfMonthIso = (): string => {
  const now = new Date()
  return toIso(new Date(now.getFullYear(), now.getMonth(), 1))
}

const endOfMonthIso = (): string => {
  const now = new Date()
  return toIso(new Date(now.getFullYear(), now.getMonth() + 1, 0))
}

const formatDate = (value: string | null): string =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString('uk-UA') : '—'

const formatQuantity = (value: number): string =>
  value.toLocaleString('uk-UA', { maximumFractionDigits: 3 })

type Preview = {
  service: MassAccrualService
  periodFrom: string
  periodTo: string
  dueOn: string
  result: MassAccrualResult
}

const schemeHint: Record<MassAccrualService['billing_mode'], string> = {
  periodic: 'Сума = площа ділянки (сотки) × тариф, чинний на початок періоду.',
  metered:
    'Сума = споживання за показаннями в межах періоду × тариф на дату показання.',
  manual: 'Однакова сума для всіх активних ділянок (вкажіть її нижче).',
}

export default function MassAccrualPage() {
  const services = useMassAccrualServiceOptions()
  const activePlots = useActiveAccrualPlots()
  const preview = usePreviewMassAccrual()
  const save = useSaveMassAccrual()

  const [serviceId, setServiceId] = useState('')
  const [periodFrom, setPeriodFrom] = useState(startOfMonthIso)
  const [periodTo, setPeriodTo] = useState(endOfMonthIso)
  const [manualAmount, setManualAmount] = useState('')
  const [dueOn, setDueOn] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 14)
    return toIso(date)
  })
  const [note, setNote] = useState('')
  const [result, setResult] = useState<Preview | null>(null)

  const service = services.data?.find((item) => item.id === serviceId)
  const mode = service?.billing_mode

  const totalMinor = useMemo(
    () => result?.result.rows.reduce((sum, row) => sum + row.amountMinor, 0) ?? 0,
    [result]
  )

  const invalidate = () => setResult(null)

  const handleCalculate = async () => {
    if (!service) {
      toast.error('Оберіть вид внеску')
      return
    }
    if (!periodFrom || !periodTo) {
      toast.error('Вкажіть період нарахування')
      return
    }
    if (periodTo < periodFrom) {
      toast.error('Дата завершення періоду має бути не раніше за початок')
      return
    }
    if (!dueOn) {
      toast.error('Вкажіть термін оплати')
      return
    }
    const manualAmountMinor = manualAmount ? majorToMinor(manualAmount) : 0
    if (service.billing_mode === 'manual' && manualAmountMinor <= 0) {
      toast.error('Вкажіть суму внеску')
      return
    }
    try {
      const computed = await preview.mutateAsync({
        service,
        periodFrom,
        periodTo,
        manualAmountMinor,
      })
      setResult({ service, periodFrom, periodTo, dueOn, result: computed })
      if (computed.rows.length === 0) {
        toast.warning('Немає активних ділянок для нарахування')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося розрахувати нарахування')
    }
  }

  const handleSave = async () => {
    if (!result || result.result.rows.length === 0) return
    const payload = result.result.rows.map((row) =>
      massRowToCharge(row, result.service, result.dueOn, note.trim() || null)
    )
    try {
      const count = await save.mutateAsync(payload)
      toast.success(`Збережено нарахувань: ${count}`)
      setResult(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не вдалося зберегти нарахування')
    }
  }

  return (
    <div>
      <PageHeader
        title="Масове нарахування"
        description="Формує нарахування для всіх активних (розподілених) ділянок за обраним видом внеску та періодом. Попередній перегляд не створює записів у базі."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="service">Вид внеску</Label>
              <Select
                value={serviceId}
                onValueChange={(value) => {
                  setServiceId(value)
                  invalidate()
                }}
              >
                <SelectTrigger id="service" className="w-full">
                  <SelectValue placeholder="Оберіть вид внеску" />
                </SelectTrigger>
                <SelectContent>
                  {services.data?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} {item.is_active ? '' : '(неактивний)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="period_from">Період з</Label>
              <Input
                id="period_from"
                type="date"
                value={periodFrom}
                onChange={(event) => {
                  setPeriodFrom(event.target.value)
                  invalidate()
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="period_to">Період по</Label>
              <Input
                id="period_to"
                type="date"
                value={periodTo}
                onChange={(event) => {
                  setPeriodTo(event.target.value)
                  invalidate()
                }}
              />
            </div>

            {mode === 'manual' ? (
              <div className="space-y-2">
                <Label htmlFor="manual_amount">Сума внеску, ₴</Label>
                <Input
                  id="manual_amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={manualAmount}
                  onChange={(event) => {
                    setManualAmount(event.target.value)
                    invalidate()
                  }}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="due_on">Термін оплати</Label>
              <Input
                id="due_on"
                type="date"
                value={dueOn}
                onChange={(event) => {
                  setDueOn(event.target.value)
                  invalidate()
                }}
              />
            </div>

            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="note">Примітка</Label>
              <Input
                id="note"
                placeholder="Необов’язково"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {service
                ? `${billingModeLabels[service.billing_mode]}. ${schemeHint[service.billing_mode]}`
                : 'Оберіть вид внеску, щоб побачити спосіб розрахунку.'}
              {activePlots.data
                ? ` Активних ділянок: ${activePlots.data.length}.`
                : ''}
            </p>
            <Button onClick={handleCalculate} disabled={preview.isPending}>
              <Calculator className="size-4" />
              {preview.isPending ? 'Розрахунок…' : 'Розрахувати'}
            </Button>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ділянка</TableHead>
                      <TableHead>Власник</TableHead>
                      <TableHead>Вид внеску</TableHead>
                      <TableHead>Період</TableHead>
                      <TableHead className="text-right">Сума, ₴</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.result.rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          Немає нарахувань для відображення.
                        </TableCell>
                      </TableRow>
                    ) : (
                      result.result.rows.map((row) => (
                        <TableRow key={row.plotId}>
                          <TableCell className="font-medium">{row.plotNo}</TableCell>
                          <TableCell>{row.ownerName}</TableCell>
                          <TableCell>
                            <div>{result.service.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatQuantity(row.quantity)}{' '}
                              {unitLabels[row.unit] ?? row.unit} ×{' '}
                              {minorToMajor(row.unitPriceMinor)} ₴
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatDate(row.periodFrom)} — {formatDate(row.periodTo)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {minorToMajor(row.amountMinor)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {result.result.skipped.length > 0 ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Пропущено ділянок: {result.result.skipped.length}
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
                    {result.result.skipped.map((skip) => (
                      <li key={skip.plotNo}>
                        Ділянка {skip.plotNo} ({skip.ownerName}) — {skip.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Готово до збереження: {result.result.rows.length} · Разом:{' '}
                  <span className="font-medium text-foreground">{minorToMajor(totalMinor)} ₴</span>
                </p>
                <Can allow={FINANCE_ROLES}>
                  <Button
                    onClick={handleSave}
                    disabled={save.isPending || result.result.rows.length === 0}
                  >
                    <Save className="size-4" />
                    {save.isPending ? 'Збереження…' : 'Зберегти нарахування'}
                  </Button>
                </Can>
              </div>
            </div>
          ) : preview.isPending ? (
            <div className="rounded-md border">
              <div className="space-y-2 p-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
