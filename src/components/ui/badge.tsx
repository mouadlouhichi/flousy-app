import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Pill badges. `lime` is the "+27%" delta chip from the reference design;
 * `success` / `warning` / `error` keep semantic deltas readable in both
 * themes.
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.01em] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-on-primary [a&]:hover:bg-forest-soft',
        lime: 'border-transparent bg-lime text-forest-deep',
        secondary:
          'border-transparent bg-surface-container-high text-on-surface [a&]:hover:bg-surface-container-highest',
        success: 'border-transparent bg-success-container text-success',
        warning: 'border-transparent bg-warning-container text-warning',
        error: 'border-transparent bg-error-container text-error',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border-outline-variant text-on-surface-variant [a&]:hover:bg-surface-container-high [a&]:hover:text-on-surface',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
