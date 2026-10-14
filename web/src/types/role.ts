export const ROLE_CODES = [
  'administrator',
  'accountant',
  'viewer',
  'member',
  'admin',
  'treasurer',
  'board',
  'workday_lead',
  'auditor',
] as const

export type RoleCode = (typeof ROLE_CODES)[number]

export const APP_ROLES: RoleCode[] = [
  'administrator',
  'accountant',
  'viewer',
  'member',
]