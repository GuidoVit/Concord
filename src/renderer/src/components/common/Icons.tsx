import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function MicIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></IconBase>
}

export function MicOffIcon(props: IconProps) {
  return <IconBase {...props}><path d="m2 2 20 20"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><path d="M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><path d="M19 10v2c0 .77-.13 1.5-.36 2.19"/><path d="M12 19v3"/></IconBase>
}

export function HeadphonesIcon(props: IconProps) {
  return <IconBase {...props}><path d="M4 14a8 8 0 0 1 16 0"/><path d="M18 19h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5a2 2 0 0 1-2 2Z"/><path d="M6 19H5a2 2 0 0 1-2-2v-5h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2Z"/></IconBase>
}

export function HeadphonesOffIcon(props: IconProps) {
  return <IconBase {...props}><path d="m2 2 20 20"/><path d="M4 14a8 8 0 0 1 1.4-4.52"/><path d="M8.37 5.3A8 8 0 0 1 20 14"/><path d="M18 19h-1a2 2 0 0 1-2-2v-2"/><path d="M6 19H5a2 2 0 0 1-2-2v-5h3a2 2 0 0 1 2 2v1"/></IconBase>
}

export function ScreenIcon(props: IconProps) {
  return <IconBase {...props}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></IconBase>
}

export function PhoneOffIcon(props: IconProps) {
  return <IconBase {...props}><path d="M10.68 13.31a16 16 0 0 0 4.01 4.01l1.35-1.35a2 2 0 0 1 2.04-.48l2.38.79a2 2 0 0 1 1.37 1.9V21a2 2 0 0 1-2 2C9.44 23 1 14.56 1 4.17a2 2 0 0 1 2-2h2.82a2 2 0 0 1 1.9 1.37l.79 2.38a2 2 0 0 1-.48 2.04L6.68 9.32"/><path d="m23 1-8 8"/><path d="m15 1 8 8"/></IconBase>
}

export function UserPlusIcon(props: IconProps) {
  return <IconBase {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></IconBase>
}

export function CopyIcon(props: IconProps) {
  return <IconBase {...props}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></IconBase>
}

export function SettingsIcon(props: IconProps) {
  return <IconBase {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></IconBase>
}

export function UsersIcon(props: IconProps) {
  return <IconBase {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></IconBase>
}

export function MessageIcon(props: IconProps) {
  return <IconBase {...props}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></IconBase>
}

export function ZoomInIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></IconBase>
}
