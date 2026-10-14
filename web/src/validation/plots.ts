import { z } from 'zod'
import { PLOT_STATUSES, type Plot } from '@/features/plots/types'

export { PLOT_STATUSES }

const MAX_AREA_M2 = 999999.99

export const plotFormSchema = z.object({
  plot_no: z.string().trim().min(1, 'Обов’язкове поле').max(20, 'Максимум 20 символів'),
  area_m2: z
    .string()
    .trim()
    .min(1, 'Вкажіть площу ділянки')
    .refine(
      (value) => /^\d+([.,]\d{1,2})?$/.test(value),
      'Площа: максимум 2 знаки після коми'
    )
    .refine(
      (value) => Number(value.replace(',', '.')) > 0,
      'Площа має бути більшою за 0'
    )
    .refine(
      (value) => Number(value.replace(',', '.')) <= MAX_AREA_M2,
      'Площа завелика (максимум 999999,99 м²)'
    ),
  zone: z.string().trim().max(100, 'Максимум 100 символів'),
  soil_type: z.string().trim().max(100, 'Максимум 100 символів'),
  owner_id: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || value === '' || /^[0-9a-f-]{36}$/i.test(value),
      'Невірний ідентифікатор власника'
    ),
  notes: z.string().trim().max(2000, 'Максимум 2000 символів'),
  status: z.enum(PLOT_STATUSES),
})

export type PlotFormValues = z.infer<typeof plotFormSchema>

export const plotFormDefaults = (plot?: Plot): PlotFormValues => ({
  plot_no: plot?.plot_no ?? '',
  area_m2: plot ? String(plot.area_m2) : '',
  zone: plot?.zone ?? '',
  soil_type: plot?.soil_type ?? '',
  owner_id: plot?.owner_id ?? '',
  notes: plot?.notes ?? '',
  status: plot?.status ?? 'free',
})