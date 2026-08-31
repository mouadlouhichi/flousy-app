'use client'

import * as React from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { useLightLanguage } from '@/lib/i18n-light'

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  const { messages: m } = useLightLanguage()

  return (
    <nav
      role="navigation"
      aria-label={m.common.accessibility.pagination}
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  React.ComponentProps<'a'>

function PaginationLink({
  className,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({
          variant: isActive ? 'outline' : 'ghost',
          size,
        }),
        className,
      )}
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  const { messages: m, isRTL } = useLightLanguage()

  return (
    <PaginationLink
      aria-label={m.common.accessibility.previousPage}
      size="default"
      className={cn('gap-1 px-2.5 sm:ps-2.5', className)}
      {...props}
    >
      {isRTL ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      <span className="hidden sm:block">{m.common.previous}</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  const { messages: m, isRTL } = useLightLanguage()

  return (
    <PaginationLink
      aria-label={m.common.accessibility.nextPage}
      size="default"
      className={cn('gap-1 px-2.5 sm:pe-2.5', className)}
      {...props}
    >
      <span className="hidden sm:block">{m.common.next}</span>
      {isRTL ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  const { messages: m } = useLightLanguage()

  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">{m.common.accessibility.morePages}</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
