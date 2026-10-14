import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setSubmitting(false)
    if (error) {
      toast.error('Не вдалося надіслати посилання для скидання', { description: error.message })
      return
    }
    toast.success('Посилання надіслано, перевірте вашу пошту')
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Скидання пароля</CardTitle>
        <CardDescription>Ми надішлемо вам безпечне посилання для скидання.</CardDescription>
      </CardHeader>
      <CardContent>
        {!isSupabaseConfigured ? (
          <Alert>
            <AlertTitle>Supabase не налаштовано</AlertTitle>
            <AlertDescription>Спочатку вкажіть VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.</AlertDescription>
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
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Надсилання…' : 'Надіслати посилання'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}