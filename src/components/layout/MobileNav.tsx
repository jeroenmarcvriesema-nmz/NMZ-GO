import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  IconLayoutDashboard, IconMapPin, IconPlus,
  IconFileExport, IconUsers, IconHome, IconCircleCheck,
} from '@tabler/icons-react'

function MobileNavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'flex flex-col items-center gap-1 px-2 py-1.5 rounded-sm text-[10px] font-semibold tracking-wide transition-colors',
        isActive ? 'text-brand-yellow' : 'text-white/40'
      )}
    >
      <span className="text-2xl">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}

export function MobileNav() {
  const { isBeheerder } = useAuth()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 z-50 flex justify-around items-center px-1 py-2 pb-safe">
      {isBeheerder ? (
        <>
          <MobileNavItem to="/dashboard"        icon={<IconLayoutDashboard />} label="Dashboard" />
          <MobileNavItem to="/werkbonnen"        icon={<IconMapPin />}          label="Werkbonnen" />
          <MobileNavItem to="/werkbonnen/nieuw"  icon={<IconPlus />}            label="Nieuw" />
          <MobileNavItem to="/rapporten"         icon={<IconFileExport />}      label="Rapporten" />
          <MobileNavItem to="/medewerkers"       icon={<IconUsers />}           label="Team" />
        </>
      ) : (
        <>
          <MobileNavItem to="/mijn-werkbonnen"   icon={<IconHome />}            label="Mijn werk" />
          <MobileNavItem to="/afgerond"          icon={<IconCircleCheck />}     label="Afgerond" />
        </>
      )}
    </nav>
  )
}
