import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  IconLayoutDashboard,
  IconFolderOpen,
  IconCalendarWeek,
  IconUsers,
  IconHome,
  IconClipboardList,
} from '@tabler/icons-react'

function MobileNavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-all',
          isActive ? 'text-brand-yellow' : 'text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'
        )
      }
    >
      <span className="text-[22px] leading-none">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}

export function MobileNav() {
  const { magWerkBeheren } = useAuth()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-1 py-2 pb-safe bg-white dark:bg-surface-dark border-t border-gray-100 dark:border-white/10">
      {magWerkBeheren ? (
        <>
          <MobileNavItem to="/dashboard"   icon={<IconLayoutDashboard />} label="Dashboard" />
          <MobileNavItem to="/projecten"   icon={<IconFolderOpen />}      label="Projecten" />
          <MobileNavItem to="/planning"    icon={<IconCalendarWeek />}    label="Planning" />
          <MobileNavItem to="/medewerkers" icon={<IconUsers />}           label="Team" />
        </>
      ) : (
        <>
          <MobileNavItem to="/mijn-werkbonnen" icon={<IconHome />}         label="Vandaag" />
          <MobileNavItem to="/mijn-week"       icon={<IconCalendarWeek />} label="Mijn week" />
          <MobileNavItem to="/mijn-bonnen"     icon={<IconClipboardList />} label="Mijn bonnen" />
        </>
      )}
    </nav>
  )
}
