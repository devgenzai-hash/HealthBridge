'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Clipboard, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/queue', label: 'Queue', icon: Clipboard },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
]

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div data-theme="dark" className="min-h-screen bg-bg pb-20">
      {children}

      {/* Bottom Navigation */}
      <nav className="bottom-nav" aria-label="Doctor navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn('bottom-nav-item', isActive && 'active')}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
