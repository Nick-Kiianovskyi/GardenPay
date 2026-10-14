import { z } from 'zod'
import type { ContributionType } from '@/features/contribution-types/types'
import {
  BILLING_MODES,
  CONTRIBUTION_KINDS,
  METER_KINDS,
} from '@/features/contribution-types/types'

export { BILLING_MODES, CONTRIBUTION_KINDS, METER_KINDS }

export const contributionTypeFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Обов’язкове поле').max(100, 'Максимум 100 символів'),
    description: z.string().trim().max(500, 'Максимум 500 символів'),
    kind: z.enum(CONTRIBUTION_KINDS),
    billing_mode: z.enum(BILLING_MODES),
    meter_kind: z
      .string()
      .optional()
      .refine(
        (value) => value === undefined || value === '' || METER_KINDS.includes(value as never),
        'Оберіть тип лічильника'
      ),
    is_active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.billing_mode === 'metered' && !data.meter_kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['meter_kind'],
        message: 'Для режиму «за лічильником» обов’язково оберіть тип лічильника',
      })
    }
    if (data.billing_mode !== 'metered' && data.meter_kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['meter_kind'],
        message: 'Тип лічильника доступний лише для режиму «за лічильником»',
      })
    }
  })

export type ContributionTypeFormValues = z.infer<typeof contributionTypeFormSchema>

export const contributionTypeFormDefaults = (
  contribution?: ContributionType
): ContributionTypeFormValues => ({
  name: contribution?.name ?? '',
  description: contribution?.description ?? '',
  kind: contribution?.kind ?? 'membership_fee',
  billing_mode: contribution?.billing_mode ?? 'periodic',
  meter_kind: contribution?.meter_kind ?? '',
  is_active: contribution?.is_active ?? true,
})

export const contributionKindLabels: Record<string, string> = {
  membership_fee: 'Членський внесок',
  plot_rent: 'Оренда ділянки',
  water: 'Вода',
  electricity: 'Електроенергія',
  penalty: 'Штраф / пеня',
  one_time: 'Цільовий внесок',
  other: 'Інше',
}

export const billingModeLabels: Record<string, string> = {
  periodic: 'Періодичний',
  metered: 'За лічильником',
  manual: 'Ручний',
}

export const meterKindLabels: Record<string, string> = {
  water: 'Вода',
  electricity: 'Електроенергія',
}