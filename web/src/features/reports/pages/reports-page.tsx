import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Users,
  ReceiptText,
  CreditCard,
  Droplets,
  Zap,
  PieChart,
  FileSpreadsheet,
  FileText,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { useReport, useFinancialSummary } from '@/features/reports/api'
import type {
  ConsumptionRow,
  FinancialSummary,
  ReportChargeRow,
  ReportDebtorRow,
  ReportKind,
  ReportPaymentRow,
} from '@/features/reports/types'
import {
  exportExcel,
  type ExportColumn,
  type ExportRow,
} from '@/features/reports/export/excel'
import { exportPdf, type PdfTable } from '@/features/reports/export/pdf'
import { minorToMajor } from '@/features/charges/business'
import { chargeStatusLabels } from '@/validation/charges'
import {
  PAYMENT_STATUSES,
  paymentMethodLabels,
  paymentStatusLabels,
} from '@/validation/payments'

const REPORTS: { kind: ReportKind; title: string; description: string; icon: typeof Users }[] = [
  { kind: 'debtors', title: 'Боржники', description: 'Члени та їх заборгованість', icon: Users },
  { kind: 'charges', title: 'Рахунки', description: 'Всі нараховані рахунки', icon: ReceiptText },
  { kind: 'payments', title: 'Платежі', description: 'Вся історія платежів', icon: CreditCard },
  { kind: 'water', title: 'Споживання води', description: 'Показники лічильників води', icon: Droplets },
  { kind: 'electricity', title: 'Споживання електроенергії', description: 'Показники лічильників світла', icon: Zap },
  { kind: 'summary', title: 'Фінансове зведення', description: 'Підсумки по рахунках і платежах', icon: PieChart },
]

const STATUS_OPTIONS: Record<Exclude<ReportKind, 'summary'>, { value: string; label: string }[]> = {
  debtors: [
    { value: 'all', label: 'Усі' },
    { value: 'debtor', label: 'Лише боржники' },
  ],
  charges: [
    { value: 'all', label: 'Усі' },
    { value: 'open', label: 'Відкриті' },
    { value: 'partially_paid', label: 'Частково сплачені' },
    { value: 'paid', label: 'Сплачені' },
    { value: 'void', label: 'Анульовані' },
    { value: 'cancelled', label: 'Скасовані' },
  ],
  payments: [
    { value: 'all', label: 'Усі' },
    ...PAYMENT_STATUSES.map((s) => ({
      value: s,
      label: paymentStatusLabels[s] ?? s,
    })),
  ],
  water: [{ value: 'all', label: 'Усі' }],
  electricity: [{ value: 'all', label: 'Усі' }],
}

const money = (minor: number) => `${minorToMajor(minor)} ₴`

const fmtDate = (s: string | null): string =>
  s ? new Date(`${s}T00:00:00`).toLocaleDateString('uk-UA') : '—'

const num3 = (n: number) => n.toLocaleString('uk-UA', { maximumFractionDigits: 3 })

function ReportPreview({
  kind,
  search,
  status,
}: {
  kind: Exclude<ReportKind, 'summary'>
  search: string
  status?: string
}) {
  const { data, isPending, isError, error } = useReport({ kind, search, status })

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
        {error instanceof Error ? error.message : 'Помилка завантаження'}
      </div>
    )
  }

  const rows = (data?.data ?? []) as (ReportDebtorRow | ReportChargeRow | ReportPaymentRow | ConsumptionRow)[]
  const count = data?.count ?? 0

  const renderRows = (): React.ReactNode => {
    if (kind === 'debtors') {
      return (rows as ReportDebtorRow[]).map((row) => (
        <TableRow key={row.member_id}>
          <TableCell>
            {row.member_name}
            <div className="text-xs text-muted-foreground">№ {row.member_no}</div>
          </TableCell>
          <TableCell><Badge variant="secondary"><span className="capitalize">{row.status}</span></Badge></TableCell>
          <TableCell className="text-right font-mono">{money(row.charges_minor)}</TableCell>
          <TableCell className="text-right font-mono">{money(row.payments_minor)}</TableCell>
          <TableCell className="text-right font-mono font-semibold">{money(row.debt_minor)}</TableCell>
        </TableRow>
      ))
    }
    if (kind === 'charges') {
      return (rows as ReportChargeRow[]).map((row) => (
        <TableRow key={row.charge_no}>
          <TableCell className="font-mono text-sm">{row.charge_no}</TableCell>
          <TableCell>{row.member ?? '—'}</TableCell>
          <TableCell>{row.plot_no ?? '—'}</TableCell>
          <TableCell>{row.service ?? '—'}</TableCell>
          <TableCell>{fmtDate(row.issued_on)}</TableCell>
          <TableCell>{fmtDate(row.due_on)}</TableCell>
          <TableCell className="text-right font-mono">{money(row.amount_minor)}</TableCell>
          <TableCell className="text-right font-mono">{money(row.paid_minor)}</TableCell>
          <TableCell>
            <Badge variant="secondary">{chargeStatusLabels[row.status] ?? row.status}</Badge>
          </TableCell>
        </TableRow>
      ))
    }
    if (kind === 'payments') {
      return (rows as ReportPaymentRow[]).map((row) => (
        <TableRow key={`${row.paid_on}-${row.reference ?? ''}-${row.amount_minor}`}>
          <TableCell>{fmtDate(row.paid_on)}</TableCell>
          <TableCell>{row.reference ?? '—'}</TableCell>
          <TableCell>{row.member ?? '—'}</TableCell>
          <TableCell>{row.charge_no ?? 'Аванс'}</TableCell>
          <TableCell>{paymentMethodLabels[row.method] ?? row.method}</TableCell>
          <TableCell className="text-right font-mono">{money(row.amount_minor)}</TableCell>
          <TableCell><Badge variant="secondary">{paymentStatusLabels[row.status] ?? row.status}</Badge></TableCell>
        </TableRow>
      ))
    }
    const cols = kind === 'water' ? ['м³', 'reading_m3', 'previous_m3', 'consumption_m3'] : ['кВт⋅год', 'reading_kwh', 'previous_kwh', 'consumption_kwh']
    const total = (rows as ConsumptionRow[]).reduce((acc, r) => acc + Number(r.consumption || 0), 0)
    return (
      <>
        {(rows as ConsumptionRow[]).map((row) => (
          <TableRow key={`${row.meter_no}-${row.read_on}`}>
            <TableCell>{fmtDate(row.read_on)}</TableCell>
            <TableCell className="font-mono text-sm">{row.meter_no}</TableCell>
            <TableCell>{row.plot_no}</TableCell>
            <TableCell className="text-right font-mono">{num3(row.reading)}</TableCell>
            <TableCell className="text-right font-mono">{num3(row.previous)}</TableCell>
            <TableCell className="text-right font-mono font-semibold">{num3(row.consumption)}</TableCell>
          </TableRow>
        ))}
        {rows.length > 0 && (
          <TableRow className="bg-muted/40 font-semibold">
            <TableCell colSpan={5} className="text-right">Разом споживання, {cols[0]}:</TableCell>
            <TableCell className="text-right font-mono">{num3(total)}</TableCell>
          </TableRow>
        )}
      </>
    )
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Знайдено: {count} рядків (показано до 1000)
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {kind === 'debtors' && (
                <>
                  <TableHead>Член</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Нараховано</TableHead>
                  <TableHead className="text-right">Сплачено</TableHead>
                  <TableHead className="text-right">Борг</TableHead>
                </>
              )}
              {kind === 'charges' && (
                <>
                  <TableHead>№</TableHead>
                  <TableHead>Член</TableHead>
                  <TableHead>Ділянка</TableHead>
                  <TableHead>Послуга</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Термін</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead className="text-right">Сплачено</TableHead>
                  <TableHead>Статус</TableHead>
                </>
              )}
              {kind === 'payments' && (
                <>
                  <TableHead>Дата</TableHead>
                  <TableHead>Референс</TableHead>
                  <TableHead>Член</TableHead>
                  <TableHead>Рахунок</TableHead>
                  <TableHead>Метод</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead>Статус</TableHead>
                </>
              )}
              {(kind === 'water' || kind === 'electricity') && (
                <>
                  <TableHead>Дата</TableHead>
                  <TableHead>Лічильник</TableHead>
                  <TableHead>Ділянка</TableHead>
                  <TableHead className="text-right">Показник</TableHead>
                  <TableHead className="text-right">Попередній</TableHead>
                  <TableHead className="text-right">Споживання</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  За даними фільтрами даних немає.
                </TableCell>
              </TableRow>
            ) : (
              renderRows()
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function SummaryPanel() {
  const { data, isPending, isError, error } = useFinancialSummary()

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
        {error instanceof Error ? error.message : 'Помилка завантаження'}
      </div>
    )
  }

  const s: FinancialSummary | null = isPending || !data ? null : data.summary
  const mk = (label: string, minor: number | undefined, extra?: string) => (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{minor === undefined && !isPending ? '…' : money(minor ?? 0)}</p>
        {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {mk('Нараховано всього', s?.charges_total_minor, `Рахунків: ${s?.charges_count ?? '—'}`)}
        {mk('Сплачено всього', s?.payments_total_minor, `Повернення: ${money(s?.refunds_minor ?? 0)}`)}
        {mk('Загальний борг', s?.debt_minor, `Боржників: ${s?.debtors_count ?? '—'}`)}
        {mk('Переплати (кредити)', s?.credit_minor)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChargeStatusTable rows={data?.charges ?? []} pending={isPending} />
        <PaymentMethodTable rows={data?.methods ?? []} pending={isPending} />
      </div>
      <MonthlyTable rows={data?.monthly ?? []} pending={isPending} />
    </div>
  )
}

function ChargeStatusTable({ rows, pending }: { rows: { status: string; count: number; amount_minor: number }[]; pending: boolean }) {
  const all = rows.find((r) => r.status === 'open')?.amount_minor ?? 0
  void all
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <h3 className="text-sm font-medium">Рахунки за статусами</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Кількість</TableHead>
                <TableHead className="text-right">Сума</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending ? (
                <TableRow><TableCell colSpan={3}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Даних немає.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.status}>
                    <TableCell>{chargeStatusLabels[r.status] ?? r.status}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.amount_minor)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function PaymentMethodTable({ rows, pending }: { rows: { method: string; kind: string; count: number; amount_minor: number }[]; pending: boolean }) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <h3 className="text-sm font-medium">Платежі за методами</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Метод</TableHead>
                <TableHead className="text-right">Кількість</TableHead>
                <TableHead className="text-right">Сума</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending ? (
                <TableRow><TableCell colSpan={3}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Даних немає.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={`${r.method}-${r.kind}`}>
                    <TableCell>{paymentMethodLabels[r.method] ?? r.method}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.amount_minor)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function MonthlyTable({ rows, pending }: { rows: { month: string; charges_minor: number; payments_minor: number; balance_minor: number }[]; pending: boolean }) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <h3 className="text-sm font-medium">Динаміка за місяцями</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Місяць</TableHead>
                <TableHead className="text-right">Нараховано</TableHead>
                <TableHead className="text-right">Сплачено</TableHead>
                <TableHead className="text-right">Баланс</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending ? (
                <TableRow><TableCell colSpan={4}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Даних немає.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-mono text-sm">{r.month}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.charges_minor)}</TableCell>
                    <TableCell className="text-right font-mono">{money(r.payments_minor)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{money(r.balance_minor)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

const FILENAMES: Record<ReportKind, string> = {
  debtors: 'debtors',
  charges: 'charges',
  payments: 'payments',
  water: 'water_consumption',
  electricity: 'electricity_consumption',
  summary: 'financial_summary',
}

const FILENAMES_UK: Record<ReportKind, string> = {
  debtors: 'Боржники',
  charges: 'Рахунки',
  payments: 'Платежі',
  water: 'Споживання води',
  electricity: 'Споживання електроенергії',
  summary: 'Фінансове зведення',
}

export default function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('debtors')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setStatus('all')
    setSearch('')
    setSearchInput('')
  }, [kind])

  const report = useReport({ kind, search, status, })
  const summary = useFinancialSummary()

  const canExport = kind === 'summary' ? Boolean(summary.data) : (report.data?.data.length ?? 0) > 0

  const buildColumns = (): ExportColumn[] => {
    switch (kind) {
      case 'debtors':
        return [
            { header: 'Член', key: 'member', width: 30 },
            { header: 'Номер', key: 'member_no', width: 10 },
            { header: 'Статус', key: 'status', width: 12 },
            { header: 'Нараховано, ₴', key: 'charges_minor', width: 14, align: 'right', kind: 'money' },
            { header: 'Сплачено, ₴', key: 'payments_minor', width: 14, align: 'right', kind: 'money' },
            { header: 'Борг, ₴', key: 'debt_minor', width: 14, align: 'right', kind: 'money' },
          ]
      case 'charges':
        return [
            { header: '№ рахунку', key: 'charge_no', width: 14 },
            { header: 'Член', key: 'member', width: 28 },
            { header: 'Ділянка', key: 'plot_no', width: 10 },
            { header: 'Послуга', key: 'service', width: 20 },
            { header: 'Дата', key: 'issued_on', width: 12 },
            { header: 'Термін', key: 'due_on', width: 12 },
            { header: 'Сума, ₴', key: 'amount_minor', width: 12, align: 'right', kind: 'money' },
            { header: 'Сплачено, ₴', key: 'paid_minor', width: 12, align: 'right', kind: 'money' },
            { header: 'Статус', key: 'status', width: 16 },
          ]
      case 'payments':
        return [
            { header: 'Дата', key: 'paid_on', width: 12 },
            { header: 'Референс', key: 'reference', width: 16 },
            { header: 'Член', key: 'member', width: 28 },
            { header: 'Рахунок', key: 'charge_no', width: 14 },
            { header: 'Метод', key: 'method', width: 18 },
            { header: 'Сума, ₴', key: 'amount_minor', width: 12, align: 'right', kind: 'money' },
            { header: 'Статус', key: 'status', width: 12 },
          ]
      case 'water':
      case 'electricity': {
        const unit = kind === 'water' ? 'м³' : 'кВт⋅год'
        return [
            { header: 'Дата', key: 'read_on', width: 12 },
            { header: 'Лічильник', key: 'meter_no', width: 14 },
            { header: 'Ділянка', key: 'plot_no', width: 10 },
            { header: `Показник, ${unit}`, key: 'reading', width: 14, align: 'right', kind: 'number' },
            { header: `Попередній, ${unit}`, key: 'previous', width: 14, align: 'right', kind: 'number' },
            { header: `Споживання, ${unit}`, key: 'consumption', width: 14, align: 'right', kind: 'number' },
          ]
      }
      case 'summary':
        return [
            { header: 'Місяць', key: 'month', width: 12 },
            { header: 'Нараховано, ₴', key: 'charges_minor', width: 14, align: 'right', kind: 'money' },
            { header: 'Сплачено, ₴', key: 'payments_minor', width: 14, align: 'right', kind: 'money' },
            { header: 'Баланс, ₴', key: 'balance_minor', width: 14, align: 'right', kind: 'money' },
          ]
    }
  }

  const rowsForExport = (): ExportRow[] => {
    const base = (report.data?.data ?? []) as (ReportDebtorRow | ReportChargeRow | ReportPaymentRow | ConsumptionRow)[]
    if (kind === 'debtors') {
      return (base as ReportDebtorRow[]).map((r) => ({
        member: r.member_name,
        member_no: r.member_no,
        status: r.status,
        charges_minor: r.charges_minor,
        payments_minor: r.payments_minor,
        debt_minor: r.debt_minor,
      }))
    }
    if (kind === 'charges') {
      return (base as ReportChargeRow[]).map((r) => ({
        charge_no: r.charge_no,
        member: r.member ?? '—',
        plot_no: r.plot_no ?? '—',
        service: r.service ?? '—',
        issued_on: fmtDate(r.issued_on),
        due_on: fmtDate(r.due_on),
        amount_minor: r.amount_minor,
        paid_minor: r.paid_minor,
        status: chargeStatusLabels[r.status] ?? r.status,
      }))
    }
    if (kind === 'payments') {
      return (base as ReportPaymentRow[]).map((r) => ({
        paid_on: fmtDate(r.paid_on),
        reference: r.reference ?? '—',
        member: r.member ?? '—',
        charge_no: r.charge_no ?? 'Аванс',
        method: paymentMethodLabels[r.method] ?? r.method,
        amount_minor: r.amount_minor,
        status: r.status,
      }))
    }
    return (base as ConsumptionRow[]).map((r) => ({
      read_on: fmtDate(r.read_on),
      meter_no: r.meter_no,
      plot_no: r.plot_no,
      reading: Number(r.reading || 0),
      previous: Number(r.previous || 0),
      consumption: Number(r.consumption || 0),
    }))
  }

  const summaryExport = (): { cols: ExportColumn[]; rows: ExportRow[]; sheets: { name: string; columns: ExportColumn[]; rows: ExportRow[] }[]; pdfTables: PdfTable[] } | null => {
    const d = summary.data
    if (!d) return null
    const s = d.summary
    const metricRows: ExportRow[] = [
      { metric: 'Нараховано всього', value: s?.charges_total_minor ?? 0 },
      { metric: 'Рахунків', value: s?.charges_count ?? 0 },
      { metric: 'Сплачено (надходження)', value: s?.payments_received_minor ?? 0 },
      { metric: 'Повернення', value: s?.refunds_minor ?? 0 },
      { metric: 'Загальний борг', value: s?.debt_minor ?? 0 },
      { metric: 'Переплати (кредити)', value: s?.credit_minor ?? 0 },
      { metric: 'Боржників', value: s?.debtors_count ?? 0 },
    ]
    const metricCols: ExportColumn[] = [
      { header: 'Показник', key: 'metric', width: 30 },
      { header: 'Значення', key: 'value', width: 16, align: 'right', kind: 'money' },
    ]
    const statusCols: ExportColumn[] = [
      { header: 'Статус', key: 'status', width: 22 },
      { header: 'Кількість', key: 'count', width: 12, align: 'right' },
      { header: 'Сума, ₴', key: 'amount_minor', width: 14, align: 'right', kind: 'money' },
    ]
    const methodCols: ExportColumn[] = [
      { header: 'Метод', key: 'method', width: 22 },
      { header: 'Тип', key: 'kind', width: 12 },
      { header: 'Кількість', key: 'count', width: 12, align: 'right' },
      { header: 'Сума, ₴', key: 'amount_minor', width: 14, align: 'right', kind: 'money' },
    ]
    const monthlyCols: ExportColumn[] = [
      { header: 'Місяць', key: 'month', width: 12 },
      { header: 'Нараховано, ₴', key: 'charges_minor', width: 14, align: 'right', kind: 'money' },
      { header: 'Сплачено, ₴', key: 'payments_minor', width: 14, align: 'right', kind: 'money' },
      { header: 'Баланс, ₴', key: 'balance_minor', width: 14, align: 'right', kind: 'money' },
    ]
    const statusRows: ExportRow[] = d.charges.map((r) => ({
      status: chargeStatusLabels[r.status] ?? r.status,
      count: r.count,
      amount_minor: r.amount_minor,
    }))
    const methodRows: ExportRow[] = d.methods.map((r) => ({
      method: paymentMethodLabels[r.method] ?? r.method,
      kind: r.kind === 'refund' ? 'Повернення' : 'Платіж',
      count: r.count,
      amount_minor: r.amount_minor,
    }))
    const monthlyRows: ExportRow[] = d.monthly.map((r) => ({
      month: r.month,
      charges_minor: r.charges_minor,
      payments_minor: r.payments_minor,
      balance_minor: r.balance_minor,
    }))
    return {
      cols: metricCols,
      rows: metricRows,
      sheets: [
        { name: 'Рахунки за статусами', columns: statusCols, rows: statusRows },
        { name: 'Платежі за методами', columns: methodCols, rows: methodRows },
        { name: 'Динаміка помісячно', columns: monthlyCols, rows: monthlyRows },
      ],
      pdfTables: [
        { title: 'Рахунки за статусами', columns: statusCols, rows: statusRows },
        { title: 'Платежі за методами', columns: methodCols, rows: methodRows },
        { title: 'Динаміка за місяцями', columns: monthlyCols, rows: monthlyRows },
      ],
    }
  }

  const exportExcelHandler = async () => {
    const filename = `${FILENAMES[kind]}_${new Date().toISOString().slice(0, 10)}.xlsx`
    try {
      if (kind === 'summary') {
        const s = summaryExport()
        if (!s) {
          toast.info('Даних для експорту немає')
          return
        }
        await exportExcel({
          title: FILENAMES_UK[kind],
          subtitle: 'Фінансове зведення асоціації',
          columns: s.cols,
          rows: s.rows,
          sheets: s.sheets,
          filename,
        })
      } else {
        const columns = buildColumns()
        await exportExcel({
          title: FILENAMES_UK[kind],
          columns,
          rows: rowsForExport(),
          filename: `${kind}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        })
      }
      toast.success('Excel-файл збережено')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка експорту')
    }
  }

  const exportPdfHandler = () => {
    try {
      if (kind === 'summary') {
        const s = summaryExport()
        if (!s) {
          toast.info('Даних для експорту немає')
          return
        }
        exportPdf({
          title: FILENAMES_UK[kind],
          subtitle: 'Фінансове зведення асоціації',
          columns: s.cols,
          rows: s.rows,
          extraTables: s.pdfTables,
          filename: `${FILENAMES[kind]}_${new Date().toISOString().slice(0, 10)}.pdf`,
        })
      } else {
        const columns = buildColumns()
        exportPdf({
          title: FILENAMES_UK[kind],
          subtitle: 'Звіт GardenPay',
          columns,
          rows: rowsForExport(),
          landscape: ['charges', 'payments', 'debtors'].includes(kind),
          filename: `${kind}_${new Date().toISOString().slice(0, 10)}.pdf`,
        })
      }
      toast.success('PDF-файл збережено')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Помилка експорту')
    }
  }

  return (
    <div>
      <PageHeader title="Звіти" description="Формування звітів та експорт в Excel / PDF." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {REPORTS.map((r) => {
          const Icon = r.icon
          const active = r.kind === kind
          return (
            <button
              key={r.kind}
              onClick={() => setKind(r.kind)}
              className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                active
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card hover:bg-accent/40'
              }`}
            >
              <Icon className={`size-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium">{r.title}</span>
              <span className="text-xs text-muted-foreground">{r.description}</span>
            </button>
          )
        })}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Пошук у звіті…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  disabled={kind === 'summary'}
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-48" aria-label="Фільтр">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(STATUS_OPTIONS[kind as Exclude<ReportKind, 'summary'>] ?? []).map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void exportExcelHandler()} disabled={!canExport}>
                <FileSpreadsheet className="size-4" />
                Excel
              </Button>
              <Button onClick={exportPdfHandler} disabled={!canExport}>
                <FileText className="size-4" />
                PDF
              </Button>
            </div>
          </div>

          {kind === 'summary' ? <SummaryPanel /> : (
            <ReportPreview key={kind} kind={kind} search={search} status={status === 'all' ? undefined : status} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}