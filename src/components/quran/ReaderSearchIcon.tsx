import type { MouseEventHandler, ReactNode } from 'react'

type SearchIconProps = { size?: number; onClick?: MouseEventHandler<SVGSVGElement> }

function ReaderSearchIcon({ variant, size = 24, onClick, children }: SearchIconProps & {
  variant: 'quick' | 'advanced'
  children: ReactNode
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48"
    fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" data-reader-search-icon={variant} onClick={onClick}>
    <circle cx="21" cy="21" r="14" />
    <path d="M31 31L41 41" />
    {children}
  </svg>
}

export function QuickSearchIcon(props: SearchIconProps) {
  return <ReaderSearchIcon {...props} variant="quick">
    <path d="M22 11L14 23H21L19 31L28 19H21Z" strokeWidth="2" />
  </ReaderSearchIcon>
}

export function AdvancedSearchIcon(props: SearchIconProps) {
  return <ReaderSearchIcon {...props} variant="advanced">
    <path d="M12 16H18M22 16H30M12 25H22M26 25H30M20 12V20M24 21V29" strokeWidth="1.9" />
  </ReaderSearchIcon>
}
