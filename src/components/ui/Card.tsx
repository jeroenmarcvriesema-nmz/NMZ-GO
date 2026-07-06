import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  children: React.ReactNode
  onClick?: () => void
  accent?: 'yellow' | 'red' | 'green'
}

export function Card({ className, children, onClick, accent }: CardProps) {
  const accents = {
    yellow: 'border-l-4 border-l-brand-yellow',
    red:    'border-l-4 border-l-brand-red',
    green:  'border-l-4 border-l-green-500',
  }
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-gray-100 rounded-lg shadow-sm p-5',
        accent && accents[accent],
        onClick && 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-brand-yellow',
        className
      )}
    >
      {children}
    </div>
  )
}
