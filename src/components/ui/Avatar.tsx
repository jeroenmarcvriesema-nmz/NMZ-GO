import { cn, initialen } from '@/lib/utils'

interface AvatarProps {
  naam: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Avatar({ naam, size = 'md', className }: AvatarProps) {
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }
  return (
    <div className={cn(
      'rounded-full bg-brand-yellow text-gray-900 flex items-center justify-center font-bold flex-shrink-0',
      sizes[size], className
    )}>
      {initialen(naam)}
    </div>
  )
}
