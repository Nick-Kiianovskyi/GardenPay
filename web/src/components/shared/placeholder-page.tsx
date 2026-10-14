import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'

export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Заглушка</CardTitle>
          <CardDescription>// TODO: реалізувати функціонал</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Підключено до маршрутного захисту; читання готове до RLS.
        </CardContent>
      </Card>
    </>
  )
}