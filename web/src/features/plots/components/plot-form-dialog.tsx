import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useOwnerOptions, useCreatePlot, useUpdatePlot } from '@/features/plots/api'
import type { Plot, PlotWriteInput } from '@/features/plots/types'
import {
  plotFormDefaults,
  plotFormSchema,
  PLOT_STATUSES,
  type PlotFormValues,
} from '@/validation/plots'

const NO_OWNER = '__none__'

type Props = {
  plot?: Plot
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const toWriteInput = (values: PlotFormValues): PlotWriteInput => ({
  plot_no: values.plot_no,
  area_m2: Number(values.area_m2.replace(',', '.')),
  zone: values.zone || null,
  soil_type: values.soil_type || null,
  owner_id: values.owner_id || null,
  notes: values.notes || null,
  status: values.status,
})

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Помилка збереження'

export function PlotFormDialog({ plot, open, onOpenChange, onSaved }: Props) {
  const isEdit = Boolean(plot)
  const createPlot = useCreatePlot()
  const updatePlot = useUpdatePlot()
  const owners = useOwnerOptions()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlotFormValues>({
    resolver: zodResolver(plotFormSchema),
    defaultValues: plotFormDefaults(plot),
  })

  useEffect(() => {
    if (open) reset(plotFormDefaults(plot))
  }, [open, plot, reset])

  const onSubmit = async (values: PlotFormValues) => {
    try {
      if (plot) {
        await updatePlot.mutateAsync({ id: plot.id, ...toWriteInput(values) })
        toast.success('Ділянку оновлено')
      } else {
        await createPlot.mutateAsync(toWriteInput(values))
        toast.success('Ділянку створено')
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редагувати ділянку' : 'Створити ділянку'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Оновити ділянку ${plot?.plot_no}.` : 'Додати нову ділянку до реєстру.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plot_no">Номер ділянки</Label>
              <Input id="plot_no" placeholder="A-01" {...register('plot_no')} />
              {errors.plot_no ? (
                <p className="text-xs text-destructive">{errors.plot_no.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="area_m2">Площа, м²</Label>
              <Input id="area_m2" type="number" min="0" step="any" {...register('area_m2')} />
              {errors.area_m2 ? (
                <p className="text-xs text-destructive">{errors.area_m2.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">Власник</Label>
              <Controller
                name="owner_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || NO_OWNER}
                    onValueChange={(value) => field.onChange(value === NO_OWNER ? '' : value)}
                  >
                    <SelectTrigger id="owner">
                      <SelectValue placeholder="Без власника" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_OWNER}>Без власника</SelectItem>
                      {owners.data?.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.last_name}, {owner.first_name} ({owner.member_no})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.owner_id ? (
                <p className="text-xs text-destructive">{errors.owner_id.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Статус</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLOT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone">Зона</Label>
              <Input id="zone" placeholder="A" {...register('zone')} />
              {errors.zone ? (
                <p className="text-xs text-destructive">{errors.zone.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil_type">Тип ґрунту</Label>
              <Input id="soil_type" {...register('soil_type')} />
              {errors.soil_type ? (
                <p className="text-xs text-destructive">{errors.soil_type.message}</p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Нотатки</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Додаткові відомості про ділянку…"
                {...register('notes')}
              />
              {errors.notes ? (
                <p className="text-xs text-destructive">{errors.notes.message}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isSubmitting || owners.isPending}>
              {isSubmitting ? 'Збереження…' : isEdit ? 'Зберегти зміни' : 'Створити ділянку'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}