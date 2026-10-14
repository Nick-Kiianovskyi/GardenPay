import { NavLink } from 'react-router-dom'
import { cn } from 'cn'
import { useAuth } from '@/features/auth/auth-context'
import { filterNavSections } from '@/config/navigation'

export function NavItems({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const { roles } = useAuth()
  const sections = filterNavSections(roles.length > 0 ? roles : ['member'])

  return (
    <div className={cn('space-y-6', collapsed && 'space-y-4')}>
      {sections.map((section) => (
        <div key={section.id}>
          {!collapsed && (
            <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </p>
          )}
          <nav className={cn('mt-2 space-y-1', collapsed && 'mt-0')}>
            {section.items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/dashboard'}
                  title={collapsed ? item.title : undefined}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      collapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && item.title}
                </NavLink>
              )
            })}
          </nav>
        </div>
      ))}
    </div>
  )
}