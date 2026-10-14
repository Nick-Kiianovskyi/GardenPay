import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <Card className="w-full max-w-lg text-left">
      <CardHeader>
        <CardTitle className="text-2xl">GardenPay</CardTitle>
        <CardDescription>
          Управління садівничим товариством — ділянки, тарифи, лічильники, нарахування та платежі в
          одному місці.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Увійдіть за допомогою облікового запису товариства. Доступ надається за запрошенням і
          залежить від ролі (Адміністратор, Бухгалтер, Спостерігач).
        </p>
        <Button asChild>
          <Link to="/login">Увійти</Link>
        </Button>
      </CardContent>
    </Card>
  )
}