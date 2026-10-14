import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { PageSpinner } from '@/components/shared/page-spinner'
import { cn } from 'cn'

const STORAGE_KEY = 'gp-sidebar-collapsed'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1'
  )

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="flex min-h-svh bg-muted/40">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className={cn('flex min-w-0 flex-1 flex-col', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <Topbar />
        <main className="flex-1 p-4 lg:p-6">
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}