import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Serene Finance alert — tonal layered surface, 1px hairline border and a
 * soft ambient shadow (Elevation Level 1) instead of the flat shadcn card.
 *
 * Body copy always stays `on-surface` / `on-surface-variant` on a low-opacity
 * tint of the tone colour, so text remains high-contrast in both light and
 * dark mode; only the leading icon carries the full tone colour.
 *
 * Pass a Lucide icon (e.g. `<AppIcon name="warning" />`) as the first child —
 * the `has-[>svg]` grid reserves the icon column automatically.
 */
const alertVariants = cva(
  'relative grid w-full items-start gap-y-1 rounded-xl border px-4 py-3 text-sm shadow-[0_1px_12px_rgba(23,29,28,0.06)] grid-cols-[0_1fr] has-[>svg]:grid-cols-[calc(var(--spacing)*5)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:translate-y-0.5',
  {
    variants: {
      variant: {
        default:
          'border-outline-variant/60 bg-surface-container-low text-on-surface [&>svg]:text-on-surface-variant',
        info: 'border-secondary/40 bg-secondary-container/35 text-on-surface [&>svg]:text-secondary',
        success: 'border-primary/40 bg-primary/10 text-on-surface [&>svg]:text-primary',
        warning:
          'border-tertiary/45 bg-tertiary-container/25 text-on-surface [&>svg]:text-tertiary',
        destructive:
          'border-error/45 bg-error-container/45 text-on-surface [&>svg]:text-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'col-start-2 min-h-4 font-semibold tracking-tight text-on-surface',
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-[13px] leading-relaxed text-on-surface-variant [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, alertVariants }
