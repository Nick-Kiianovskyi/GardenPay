import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { PageSpinner } from '@/components/shared/page-spinner'

export function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-14 items-center px-4">
          <span className="truncate font-semibold tracking-tight">
            GardenPay Облік садового товариства
          </span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}