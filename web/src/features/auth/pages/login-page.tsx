import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') ?? '/dashboard'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) {
      toast.error('Не вдалося увійти', { description: error.message })
      return
    }
    toast.success('Ви увійшли')
    navigate(next, { replace: true })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Вхід</CardTitle>
        <CardDescription>Доступ до робочого простору GardenPay.</CardDescription>
      </CardHeader>
      <CardContent>
        {!isSupabaseConfigured ? (
          <Alert>
            <AlertTitle>Supabase не налаштовано</AlertTitle>
            <AlertDescription>
              Скопіюйте web/.env.example у web/.env і вкажіть реквізити проєкту.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Вхід…' : 'Увійти'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Забули пароль?{' '}
              <Link to="/forgot-password" className="underline underline-offset-4 hover:text-foreground">
                Скинути
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  )
}