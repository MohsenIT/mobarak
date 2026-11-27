import type { ReactNode } from 'react'

type SearchIconProps = { size?: number }

function ReaderSearchIcon({ variant, size = 24, children }: SearchIconProps & {
  variant: 'quick' | 'advanced'
  children: ReactNode
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48"
    fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" data-reader-search-icon={variant}>
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
    <g strokeWidth="2">
      <path d="M12 16H22M28 16H30" />
      <path d="M12 25H14M20 25H30" />
      <circle cx="25" cy="16" r="3" />
      <circle cx="17" cy="25" r="3" />
    </g>
  </ReaderSearchIcon>
}
