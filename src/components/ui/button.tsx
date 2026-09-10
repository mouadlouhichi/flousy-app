import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Pill buttons, straight from the reference design: a solid forest primary
 * ("Deposit"), a white pill with a hairline border ("Send"), and a lime
 * accent for the highlighted action ("Swap"). Every size is fully rounded.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-[-0.005em] transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-on-primary shadow-[0_8px_20px_-8px_rgba(15,59,54,0.45)] hover:bg-forest-soft dark:hover:bg-lime-bright',
        accent:
          'bg-lime text-forest-deep hover:bg-lime-bright shadow-[0_8px_20px_-10px_rgba(15,59,54,0.35)]',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border border-outline-variant bg-surface-container-lowest text-on-surface shadow-ambient hover:bg-surface-container-high hover:border-outline/60',
        secondary:
          'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
        ghost:
          'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        link: 'text-primary underline-offset-4 hover:underline rounded-none',
      },
      size: {
        default: 'h-11 px-5 has-[>svg]:px-4',
        sm: 'h-9 gap-1.5 px-4 text-[13px] has-[>svg]:px-3',
        lg: 'h-13 px-7 text-[15px] has-[>svg]:px-5',
        xl: 'h-14 px-8 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9',
        'icon-lg': 'size-13',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
