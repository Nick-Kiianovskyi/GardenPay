import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { NavItems } from '@/components/layout/nav-items'
import { UserMenu } from '@/components/layout/user-menu'

export function Topbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="lg:hidden">
              <Menu className="size-4" />
              <span className="sr-only">Відкрити меню</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 gap-0 p-0" showCloseButton={false}>
            <SheetHeader className="flex h-14 flex-row items-center justify-between border-b px-4">
              <SheetTitle className="min-w-0 truncate">
                GardenPay Облік садового товариства
              </SheetTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
                <X className="size-4" />
                <span className="sr-only">Закрити меню</span>
              </Button>
            </SheetHeader>
            <div className="overflow-y-auto p-3">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <span
          className="max-w-[60vw] truncate text-sm font-semibold tracking-tight lg:hidden"
          title="GardenPay Облік садового товариства"
        >
          GardenPay Облік садового товариства
        </span>
      </div>
      <UserMenu />
    </header>
  )
}