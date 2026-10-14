import { z } from 'zod'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONEY_PATTERN = /^\d+([.,]\d{1,2})?$/
const UUID_PATTERN = /^[0-9a-f-]{36}$/i

export const PAYMENT_METHODS = ['bank_transfer', 'sepa_direct_debit', 'cash', 'card', 'other'] as const
export const PAYMENT_STATUSES = ['pending', 'matched', 'cleared', 'void'] as const

export const paymentFormSchema = z.object({
  member_id: z
    .string()
    .min(1, 'Оберіть члена')
    .refine((value) => UUID_PATTERN.test(value), 'Невірний ідентифікатор члена'),
  charge_id: z.string().refine(
    (value) => value === '' || UUID_PATTERN.test(value),
    'Невірний ідентифікатор рахунку'
  ),
  amount: z
    .string()
    .trim()
    .min(1, 'Вкажіть суму')
    .regex(MONEY_PATTERN, 'Сума: максимум 2 знаки після коми')
    .refine((value) => Number(value.replace(',', '.')) > 0, 'Сума має бути більшою за 0'),
  paid_on: z.string().min(1, 'Обов’язкове поле').regex(DATE_PATTERN, 'Невірна дата платежу'),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUSES),
  reference: z.string().trim().max(100, 'Максимум 100 символів'),
  note: z.string().trim().max(500, 'Максимум 500 символів'),
})

export type PaymentFormValues = z.infer<typeof paymentFormSchema>

export const paymentFormDefaults = (): PaymentFormValues => ({
  member_id: '',
  charge_id: '',
  amount: '',
  paid_on: new Date().toISOString().slice(0, 10),
  method: 'bank_transfer',
  status: 'cleared',
  reference: '',
  note: '',
})

export const paymentMethodLabels: Record<string, string> = {
  bank_transfer: 'Банківський переказ',
  sepa_direct_debit: 'Пряме дебетування',
  cash: 'Готівка',
  card: 'Картка',
  other: 'Інше',
}

export const paymentStatusLabels: Record<string, string> = {
  pending: 'очікує',
  matched: 'співставлено',
  cleared: 'проведено',
  void: 'анульовано',
}