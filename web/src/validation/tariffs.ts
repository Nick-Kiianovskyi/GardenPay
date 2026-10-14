import { z } from 'zod'
import type { TariffUnit } from '@/features/tariffs/types'

export const TARIFF_UNITS = ['fixed', 'm3', 'kwh', 'm2', 'hour', 'piece'] as const

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONEY_PATTERN = /^\d+([.,]\d{1,2})?$/

export const tariffFormSchema = z
  .object({
    contribution_type_id: z
      .string()
      .min(1, 'Оберіть послугу (вид внеску)')
      .refine((value) => /^[0-9a-f-]{36}$/i.test(value), 'Невірний ідентифікатор послуги'),
    rate: z
      .string()
      .trim()
      .min(1, 'Вкажіть розмір тарифу')
      .regex(MONEY_PATTERN, 'Тариф: максимум 2 знаки після коми')
      .refine((value) => Number(value.replace(',', '.')) >= 0, 'Тариф не може бути від’ємним'),
    unit: z.enum(TARIFF_UNITS),
    valid_from: z
      .string()
      .min(1, 'Обов’язкове поле')
      .regex(DATE_PATTERN, 'Невірна дата початку дії'),
    valid_to: z
      .string()
      .refine((value) => value === '' || DATE_PATTERN.test(value), 'Невірна дата завершення дії'),
  })
  .superRefine((data, ctx) => {
    if (data.valid_from && data.valid_to && data.valid_to <= data.valid_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valid_to'],
        message: 'Дата завершення має бути пізнішою за дату початку',
      })
    }
  })

export type TariffFormValues = z.infer<typeof tariffFormSchema>

export const tariffFormDefaults = (tariff?: {
  contribution_type_id?: string
  unit?: TariffUnit
  valid_from?: string
  valid_to?: string | null
}): TariffFormValues => ({
  contribution_type_id: tariff?.contribution_type_id ?? '',
  rate: '',
  unit: tariff?.unit ?? 'fixed',
  valid_from: tariff?.valid_from ?? '',
  valid_to: tariff?.valid_to ?? '',
})

export const unitLabels: Record<string, string> = {
  fixed: 'Фіксовано',
  m3: 'м³',
  kwh: 'кВт·год',
  m2: 'м²',
  hour: 'годинa',
  piece: 'шт',
}