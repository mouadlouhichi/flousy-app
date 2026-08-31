'use client'

import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useLightLanguage } from '@/lib/i18n-light'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  const { messages: m } = useLightLanguage()

  return (
    <Loader2Icon
      role="status"
      aria-label={m.common.accessibility.loading}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
