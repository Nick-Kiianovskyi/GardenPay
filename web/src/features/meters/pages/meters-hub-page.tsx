import { Droplets, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'

const sections = [
  {
    title: 'Водяні лічильники',
    description: 'Журнал показань водяних лічильників: попереднє, поточне та розраховане споживання.',
    href: '/meters/water',
    icon: Droplets,
  },
  {
    title: 'Електричні лічильники',
    description: 'Журнал показань електролічильників: попереднє, поточне та розраховане споживання.',
    href: '/meters/electricity',
    icon: Zap,
  },
]

export default function MetersHubPage() {
  return (
    <div>
      <PageHeader
        title="Лічильники"
        description="Журнали показань лічильників у садівничому товаристві."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Link key={section.href} to={section.href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-accent/40">
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription className="mt-1">{section.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="text-sm font-medium text-primary">Відкрити журнал →</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}