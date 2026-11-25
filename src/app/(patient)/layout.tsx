'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, FileText, Calendar, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/appointments', label: 'Appts', icon: Calendar },
  { href: '/profile', label: 'More', icon: MoreHorizontal },
]

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div data-theme="light" className="min-h-screen bg-bg pb-20">
      {children}

      {/* Bottom Navigation */}
      <nav className="bottom-nav" aria-label="Patient navigation">
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
