import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import {
  IconLayoutDashboard,
  IconFolderOpen,
  IconCalendarWeek,
  IconMapPin,
  IconPlus,
  IconFileExport,
  IconUsers,
  IconHome,
  IconCircleCheck,
  IconClipboardCheck,
  IconLogout,
} from '@tabler/icons-react'

const NAV_BG = '#0d1117'
const NAV_BORDER = 'rgba(255,255,255,0.06)'
const NAV_TEXT_DIM = 'rgba(255,255,255,0.35)'

function NavSection({ label }: { label: string }) {
  return (
    <p
      className="text-[10px] font-bold tracking-widest px-3 py-2 uppercase mt-3 first:mt-0"
      style={{ color: NAV_TEXT_DIM }}
    >
      {label}
    </p>
  )
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-brand-yellow text-gray-900 font-semibold shadow-sm'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        )
      }
    >
      <span className="text-[19px] flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  const { profile, signOut, isBeheerder } = useAuth()
  const navigate = useNavigate()
  const handleSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <aside
      className="w-60 flex flex-col fixed top-0 left-0 bottom-0 z-50"
      style={{ backgroundColor: NAV_BG }}
    >
      <div className="p-5" style={{ borderBottom: `1px solid ${NAV_BORDER}` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-yellow flex items-center justify-center flex-shrink-0">
            <IconClipboardCheck className="w-5 h-5 text-gray-900" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-white tracking-tight">NMZ GO</div>
            <div className="text-[11px]" style={{ color: NAV_TEXT_DIM }}>
              {isBeheerder ? 'Beheerder' : 'Medewerker'}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {isBeheerder ? (
          <>
            <NavSection label="Overzicht" />
            <NavItem to="/dashboard" icon={<IconLayoutDashboard />} label="Dashboard" />
            <NavItem to="/projecten" icon={<IconFolderOpen />}      label="Projecten" />
            <NavItem to="/planning"  icon={<IconCalendarWeek />}    label="Planning" />

            <NavSection label="Werkbonnen" />
            <NavItem to="/werkbonnen"       icon={<IconMapPin />} label="Alle werkbonnen" />
            <NavItem to="/werkbonnen/nieuw" icon={<IconPlus />}   label="Nieuwe werkbon" />

            <NavSection label="Beheer" />
            <NavItem to="/rapporten"   icon={<IconFileExport />} label="Rapporten" />
            <NavItem to="/medewerkers" icon={<IconUsers />}      label="Medewerkers" />
          </>
        ) : (
          <>
            <NavSection label="Mijn werk" />
            <NavItem to="/mijn-werkbonnen" icon={<IconHome />}        label="Mijn werkbonnen" />
            <NavItem to="/afgerond"        icon={<IconCircleCheck />} label="Afgerond" />
          </>
        )}
      </nav>

      <div className="p-4" style={{ borderTop: `1px solid ${NAV_BORDER}` }}>
        <div className="flex items-center gap-3">
          {profile && <Avatar naam={profile.naam} size="sm" />}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{profile?.naam ?? '—'}</div>
            <div className="text-[11px]" style={{ color: NAV_TEXT_DIM }}>
              {isBeheerder ? 'Beheerder' : 'Monteur'}
            </div>
          </div>
          <button onClick={handleSignOut} className="text-white/40 hover:text-white transition-colors" title="Uitloggen">
            <IconLogout className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
