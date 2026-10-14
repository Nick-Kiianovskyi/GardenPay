import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CreditCard,
  Gauge,
  Layers,
  LayoutDashboard,
  ListPlus,
  Map,
  ReceiptText,
  Settings,
  Tags,
  UserMinus,
  Users,
} from 'lucide-react'
import type { RoleCode } from '@/types/role'

export type NavItem = {
  title: string
  href: string
  allow: RoleCode[]
  icon: LucideIcon
}

export type NavSection = {
  id: string
  label: string
  items: NavItem[]
}

export const ALL_ROLES: RoleCode[] = ['administrator', 'accountant', 'viewer', 'member']

export const ADMIN_ROLES: RoleCode[] = ['administrator']

export const FINANCE_ROLES: RoleCode[] = ['administrator', 'accountant']

export const READER_ROLES: RoleCode[] = ['administrator', 'accountant', 'viewer']

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    label: 'Меню',
    items: [
      { title: 'Панель керування', href: '/dashboard', allow: ALL_ROLES, icon: LayoutDashboard },
    ],
  },
  {
    id: 'registry',
    label: 'Реєстри',
    items: [
      { title: 'Дачники', href: '/members', allow: READER_ROLES, icon: Users },
      { title: 'Ділянки', href: '/plots', allow: READER_ROLES, icon: Map },
      {
        title: 'Види внесків',
        href: '/contributions',
        allow: READER_ROLES,
        icon: Layers,
      },
      { title: 'Тарифи', href: '/tariffs', allow: READER_ROLES, icon: Tags },
      { title: 'Лічильники', href: '/meters', allow: READER_ROLES, icon: Gauge },
    ],
  },
  {
    id: 'finance',
    label: 'Фінанси',
    items: [
      { title: 'Нарахування', href: '/accruals', allow: FINANCE_ROLES, icon: ReceiptText },
      { title: 'Масове нарахування', href: '/accruals/mass', allow: FINANCE_ROLES, icon: ListPlus },
      { title: 'Оплати', href: '/payments', allow: FINANCE_ROLES, icon: CreditCard },
      { title: 'Боржники', href: '/debtors', allow: FINANCE_ROLES, icon: UserMinus },
      { title: 'Звіти', href: '/reports', allow: FINANCE_ROLES, icon: BarChart3 },
    ],
  },
  {
    id: 'system',
    label: 'Система',
    items: [{ title: 'Налаштування', href: '/settings', allow: ADMIN_ROLES, icon: Settings }],
  },
]

export const filterNavSections = (roles: RoleCode[]): NavSection[] =>
  NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.allow.some((role) => roles.includes(role))),
  })).filter((section) => section.items.length > 0)