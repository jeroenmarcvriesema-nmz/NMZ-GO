interface SectionHeadingProps {
  title: string
  actions?: React.ReactNode
  className?: string
}

export function SectionHeading({ title, actions, className }: SectionHeadingProps) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-4 ${className ?? ''}`}>
      <div className="flex items-center gap-2.5">
        <span className="w-1 h-4 rounded-full bg-brand-yellow flex-shrink-0" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{title}</h2>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
