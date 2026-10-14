import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'

export function ForbiddenPage() {
  return (
    <div>
      <PageHeader title="403 — Доступ заборонено" description="Ваші ролі не дозволяють доступ до цієї сторінки." />
      <Button asChild variant="outline">
        <Link to="/dashboard">До панелі керування</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <PageHeader title="404" description="Сторінку не знайдено." />
      <Button asChild variant="outline">
        <Link to="/">На головну</Link>
      </Button>
    </div>
  )
}

export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Неочікувана помилка'

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <PageHeader title="Щось пішло не так" description={message} />
      <Button asChild variant="outline">
        <Link to="/">На головну</Link>
      </Button>
    </div>
  )
}