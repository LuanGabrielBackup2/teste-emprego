import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 18, children, ...props }: IconProps & { children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{children}</svg>
}

export const ArrowDownIcon = (props: IconProps) => <Icon {...props}><path d="M12 4v15M19 12l-7 7-7-7" /></Icon>
export const ArrowLeftIcon = (props: IconProps) => <Icon {...props}><path d="M19 12H5m7 7-7-7 7-7" /></Icon>
export const ArrowRightIcon = (props: IconProps) => <Icon {...props}><path d="M5 12h14m-7-7 7 7-7 7" /></Icon>
export const ArrowUpRightIcon = (props: IconProps) => <Icon {...props}><path d="M7 17 17 7M7 7h10v10" /></Icon>
export const CheckIcon = (props: IconProps) => <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>
export const ChevronDownIcon = (props: IconProps) => <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>
export const LeafIcon = (props: IconProps) => <Icon {...props}><path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-6 8-16Z"/><path d="M4 21c2-5 6-9 12-12"/></Icon>
export const SearchIcon = (props: IconProps) => <Icon {...props}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></Icon>
export const SlidersIcon = (props: IconProps) => <Icon {...props}><path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></Icon>
