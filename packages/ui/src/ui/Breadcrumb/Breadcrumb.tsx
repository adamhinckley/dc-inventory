'use client'

import Link from 'next/link'
import { Children, isValidElement, type ComponentPropsWithRef, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '#cn'

export interface BreadcrumbProps extends ComponentPropsWithRef<'nav'> {
  children: ReactNode
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `dashboard-topbar-breadcrumb`.
   */
  'data-testid'?: string
}

export interface BreadcrumbItemProps extends Omit<ComponentPropsWithRef<'a'>, 'href'> {
  href?: string
  current?: boolean
  children: ReactNode
}

/**
 * Path trail for the app topbar. Separators are a forward chevron — do not
 * insert `/` between items.
 *
 * @when Page location in `AppShell.Topbar`.
 * @avoid In-page duplicate trails once the topbar owns breadcrumbs.
 */
export function BreadcrumbRoot({ children, className, ref, ...rest }: BreadcrumbProps) {
  const items = Children.toArray(children).filter(isValidElement)

  return (
    <nav ref={ref} aria-label="Breadcrumb" className={cn('min-w-0', className)} {...rest}>
      <ol className="flex min-w-0 flex-wrap items-center gap-icon">
        {items.map((child, index) => (
          <li key={index} className="flex min-w-0 items-center gap-icon">
            {index > 0 ? (
              <ChevronRight className="size-icon-sm shrink-0 text-fg-muted" aria-hidden />
            ) : null}
            {child}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * One trail segment. Pass `href` for ancestors; `current` marks the page.
 */
export function BreadcrumbItem({
  href,
  current,
  children,
  className,
  ref,
  ...rest
}: BreadcrumbItemProps) {
  if (href && !current) {
    return (
      <Link
        ref={ref}
        href={href}
        className={cn('page-breadcrumb hover:text-fg', className)}
        {...rest}
      >
        {children}
      </Link>
    )
  }

  return (
    <span
      className={cn('page-breadcrumb-current', className)}
      aria-current={current ? 'page' : undefined}
    >
      {children}
    </span>
  )
}
