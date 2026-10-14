import { z } from 'zod'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONEY_PATTERN = /^\d+([.,]\d{1,2})?$/
const UUID_PATTERN = /^[0-9a-f-]{36}$/i

export const chargeFormSchema = z.object({
  contribution_type_id: z
    .string()
    .min(1, 'Оберіть послугу (вид внеску)')
    .refine((value) => UUID_PATTERN.test(value), 'Невірний ідентифікатор послуги'),
  member_id: z
    .string()
    .refine(
      (value) => value === '' || UUID_PATTERN.test(value),
      'Невірний ідентифікатор члена'
    ),
  plot_id: z
    .string()
    .refine((value) => value === '' || UUID_PATTERN.test(value), 'Невірний ідентифікатор ділянки'),
  reading_id: z
    .string()
    .refine(
      (value) => value === '' || UUID_PATTERN.test(value),
      'Невірний ідентифікатор показання'
    ),
  manual_amount: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || MONEY_PATTERN.test(value),
      'Сума: максимум 2 знаки після коми'
    )
    .refine(
      (value) => value === '' || Number(value.replace(',', '.')) >= 0,
      'Сума не може бути від’ємною'
    ),
  due_on: z
    .string()
    .min(1, 'Обов’язкове поле')
    .regex(DATE_PATTERN, 'Невірна дата терміну оплати'),
  note: z.string().trim().max(500, 'Максимум 500 символів'),
})

export type ChargeFormValues = z.infer<typeof chargeFormSchema>

export const chargeFormDefaults = (): ChargeFormValues => ({
  contribution_type_id: '',
  member_id: '',
  plot_id: '',
  reading_id: '',
  manual_amount: '',
  due_on: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  note: '',
})

export const chargeStatusLabels: Record<string, string> = {
  draft: 'чернетка',
  open: 'відкрито',
  partially_paid: 'частково сплачено',
  paid: 'сплачено',
  void: 'анульовано',
  cancelled: 'скасовано',
}