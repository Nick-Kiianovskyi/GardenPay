import { z } from 'zod'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const READING_PATTERN = /^\d+([.,]\d{1,3})?$/

export const waterReadingFormSchema = z.object({
  plot_id: z
    .string()
    .min(1, 'Оберіть ділянку')
    .refine((value) => /^[0-9a-f-]{36}$/i.test(value), 'Невірний ідентифікатор ділянки'),
  read_on: z
    .string()
    .min(1, 'Обов’язкове поле')
    .regex(DATE_PATTERN, 'Невірна дата зняття показання'),
  reading: z
    .string()
    .trim()
    .min(1, 'Вкажіть поточне показання')
    .regex(READING_PATTERN, 'Показання: максимум 3 знаки після коми')
    .refine(
      (value) => Number(value.replace(',', '.')) >= 0,
      'Показання не можуть бути від’ємними'
    )
    .refine(
      (value) => Number(value.replace(',', '.')) <= 999999.999,
      'Показання завелике (максимум 999999,999 м³)'
    ),
  note: z.string().trim().max(500, 'Максимум 500 символів'),
})

export type WaterReadingFormValues = z.infer<typeof waterReadingFormSchema>

export const waterReadingFormDefaults = (): WaterReadingFormValues => ({
  plot_id: '',
  read_on: new Date().toISOString().slice(0, 10),
  reading: '',
  note: '',
})