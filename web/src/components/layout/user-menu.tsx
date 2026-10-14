import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/auth-context'

export function UserMenu() {
  const { user, roles, signOut } = useAuth()
  const initials = (user?.email?.[0] ?? '?').toUpperCase()

  const onSignOut = async () => {
    await signOut()
    toast.info('Ви вийшли з облікового запису')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="rounded-full">
          <Avatar>
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-medium">{user?.email}</div>
          <div className="mt-0.5 text-xs font-normal text-muted-foreground">
            {roles.length > 0 ? roles.join(', ') : 'member'}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/me">Мій профіль</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/me/bills">Мої рахунки</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>Вийти</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}