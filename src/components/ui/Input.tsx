import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-gray-600 dark:text-white/60">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'w-full px-3.5 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/30',
          'focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20',
          error && 'border-brand-red focus:border-brand-red focus:ring-brand-red/20',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-brand-red font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400 dark:text-white/40">{hint}</p>}
    </div>
  )
)
Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-semibold text-gray-600 dark:text-white/60">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3.5 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 rounded-sm outline-none transition-all resize-y placeholder:text-gray-400 dark:placeholder:text-white/30',
          'focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20',
          error && 'border-brand-red',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-brand-red font-medium">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'
