import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  children: React.ReactNode
  onClick?: () => void
  accent?: 'yellow' | 'red' | 'green'
  /**
   * Vervangt de standaard witte achtergrond en grijze rand door eigen
   * klassen — bijvoorbeeld een zachte tint in de kleur van een status.
   *
   * Vervángt, en komt er niet bovenop: `cn` is clsx en lost botsende
   * Tailwind-klassen niet op, dus twee achtergronden in één klassenrij
   * laten de uitkomst afhangen van de volgorde in de stylesheet. Dan is
   * het maar beter dat er één is.
   */
  vlak?: string
}

export function Card({ className, children, onClick, accent, vlak }: CardProps) {
  const accents = {
    yellow: 'border-l-4 border-l-brand-yellow',
    red:    'border-l-4 border-l-brand-red',
    green:  'border-l-4 border-l-green-500',
  }
  return (
    <div
      onClick={onClick}
      className={cn(
        'border rounded-lg shadow-sm p-6',
        vlak ?? 'bg-white dark:bg-surface-dark-2 border-gray-100 dark:border-white/10',
        accent && accents[accent],
        onClick && 'cursor-pointer transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-md hover:border-brand-yellow',
        className
      )}
    >
      {children}
    </div>
  )
}
