import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { useAuth } from '@/features/auth/auth-context'
import { useMyMember, useMyPlots } from '@/features/billing/api'
import { MEMBER_KIND_LABELS, MEMBER_STATUS_LABELS } from '@/validation/members'
import type { Member, MemberStatus } from '@/features/members/types'
import { sotkaQuantity } from '@/features/charges/business'

const statusVariant = (status: MemberStatus) => {
  switch (status) {
    case 'pending':
      return 'secondary'
    case 'active':
      return 'default'
    case 'suspended':
      return 'destructive'
    case 'lapsed':
      return 'outline'
  }
}

const formatDate = (iso: string | null): string =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('uk-UA') : '—'

const relationLabel: Record<string, string> = {
  owner: 'Власник',
  tenant: 'Орендар',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function MemberCard({ member }: { member: Member }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Особисті дані</CardTitle>
        <CardDescription>Запис у реєстрі членів товариства.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="№ члена" value={<span className="font-mono">{member.member_no}</span>} />
          <Field label="Статус" value={<Badge variant={statusVariant(member.status)}>{MEMBER_STATUS_LABELS[member.status]}</Badge>} />
          <Field label="Ім’я" value={member.first_name} />
          <Field label="Прізвище" value={member.last_name} />
          <Field label="Email" value={member.email ?? '—'} />
          <Field label="Телефон" value={member.phone ?? '—'} />
          <Field label="Тип" value={MEMBER_KIND_LABELS[member.kind]} />
          <Field label="Дата вступу" value={formatDate(member.joined_on)} />
          <Field label="Дата виходу" value={formatDate(member.left_on)} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: member, isPending, isError, error } = useMyMember(userId)
  const { data: plots, isPending: plotsPending } = useMyPlots(member?.id ?? '')

  return (
    <div className="space-y-4">
      <PageHeader
        title="Мій профіль"
        description="Ваш запис у реєстрі членів і закріплені за вами ділянки."
      />

      {isError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : 'Не вдалося завантажити профіль'}
        </div>
      ) : isPending ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      ) : !member ? (
        <Alert className="max-w-lg">
          <AlertTitle>Обліковий запис не прив’язаний до члена</AlertTitle>
          <AlertDescription>
            Ваш користувацький запис не пов’язано з жодним членом товариства. Зверніться до правління,
            щоб вас прив’язали до запису члена.
          </AlertDescription>
        </Alert>
      ) : (
        <MemberCard member={member} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Мої ділянки</CardTitle>
          <CardDescription>Ділянки, закріплені за вами у поточний момент та в минулому.</CardDescription>
        </CardHeader>
        <CardContent>
          {plotsPending ? (
            <Skeleton className="h-5 w-1/2" />
          ) : (plots ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">За вами не закріплена жодна ділянка.</p>
          ) : (
            <ul className="divide-y">
              {(plots ?? []).map((assignment) => {
                const plot = assignment.plots
                if (!plot) return null
                const active = assignment.end_on === null
                return (
                  <li key={assignment.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <div className="font-medium">
                        <span className="font-mono text-sm">{plot.plot_no}</span>
                        {active && <Badge className="ml-2" variant="default">закріплена</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {relationLabel[assignment.relation] ?? assignment.relation} · з{' '}
                        {formatDate(assignment.start_on)}
                        {assignment.end_on ? ` по ${formatDate(assignment.end_on)}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div>{plot.area_m2.toLocaleString('uk-UA')} м²</div>
                      <div className="text-xs text-muted-foreground">{sotkaQuantity(plot.area_m2)} соток</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}