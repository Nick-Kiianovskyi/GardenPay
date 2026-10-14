import { z } from 'zod'
import { MEMBER_KINDS, MEMBER_STATUSES, type Member } from '@/features/members/types'

export { MEMBER_KINDS, MEMBER_STATUSES }

export const MEMBER_KIND_LABELS: Record<(typeof MEMBER_KINDS)[number], string> = {
  full: 'Повноправний член',
  tenant: 'Орендар',
  associate: 'Асоційований член',
  honorary: 'Почесний член',
}

export const MEMBER_STATUS_LABELS: Record<(typeof MEMBER_STATUSES)[number], string> = {
  pending: 'Очікує активації',
  active: 'Активний',
  suspended: 'Призупинено',
  lapsed: 'Завершено',
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const memberFormSchema = z
  .object({
    member_no: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9-]{2,20}$/,
        'Номер члена: 2–20 символів (літери, цифри, дефіс)'
      ),
    first_name: z.string().trim().min(1, 'Обов’язкове поле').max(100, 'Максимум 100 символів'),
    last_name: z.string().trim().min(1, 'Обов’язкове поле').max(100, 'Максимум 100 символів'),
    email: z
      .string()
      .trim()
      .max(200, 'Максимум 200 символів')
      .refine((value) => value === '' || EMAIL_PATTERN.test(value), 'Недійсний формат email'),
    phone: z.string().trim().max(40, 'Максимум 40 символів'),
    kind: z.enum(MEMBER_KINDS),
    status: z.enum(MEMBER_STATUSES),
    joined_on: z.string().min(1, 'Обов’язкове поле'),
    left_on: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.left_on && data.joined_on && data.left_on < data.joined_on) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['left_on'],
        message: 'Дата завершення не може бути раніше дати початку',
      })
    }
  })

export type MemberFormValues = z.infer<typeof memberFormSchema>

export const todayIso = (): string => new Date().toISOString().slice(0, 10)

export const memberFormDefaults = (member?: Member): MemberFormValues => ({
  member_no: member?.member_no ?? '',
  first_name: member?.first_name ?? '',
  last_name: member?.last_name ?? '',
  email: member?.email ?? '',
  phone: member?.phone ?? '',
  kind: member?.kind ?? 'full',
  status: member?.status ?? 'active',
  joined_on: member?.joined_on ?? todayIso(),
  left_on: member?.left_on ?? '',
})