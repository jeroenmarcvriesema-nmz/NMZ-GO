import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { useThemeStore } from '@/store/themeStore'
import { rolLabel } from '@/lib/utils'
import {
  IconActivity,
  IconLayoutDashboard,
  IconFolderOpen,
  IconCalendarWeek,
  IconMapPin,
  IconPlus,
  IconFileExport,
  IconUsers,
  IconHome,
  IconClipboardList,
  IconClipboardCheck,
  IconArchive,
  IconClockExclamation,
  IconTruck,
  IconBug,
  IconLogout,
  IconSun,
  IconMoon,
} from '@tabler/icons-react'

function NavSection({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold tracking-widest px-3 py-2 uppercase mt-3 first:mt-0 text-gray-400 dark:text-white/35">
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
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-brand',
          isActive
            ? 'bg-brand-yellow text-gray-900 font-semibold shadow-sm'
            : 'text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10'
        )
      }
    >
      <span className="text-[19px] flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  const { profile, signOut, magWerkBeheren, magGebruikersBeheren, isEigenaar } = useAuth()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const handleSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <aside className="w-60 flex flex-col fixed top-0 left-0 bottom-0 z-50 bg-white dark:bg-surface-dark border-r border-gray-100 dark:border-white/10">
      <div className="p-5 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-yellow flex items-center justify-center flex-shrink-0">
            <IconClipboardCheck className="w-5 h-5 text-gray-900" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">NMZ GO</div>
            <div className="text-[11px] text-gray-400 dark:text-white/35">
              {rolLabel(profile?.rol)}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {magWerkBeheren ? (
          <>
            <NavSection label="Overzicht" />
            <NavItem to="/dashboard" icon={<IconLayoutDashboard />} label="Dashboard" />
            <NavItem to="/projecten" icon={<IconFolderOpen />}      label="Projecten" />
            <NavItem to="/planning"  icon={<IconCalendarWeek />}    label="Planning" />

            <NavItem to="/lopend"    icon={<IconActivity />} label="Lopend" />
            <NavItem to="/uitloop"   icon={<IconClockExclamation />} label="Uitloop" />
            {/* Containers en dixi's: een eigen scherm en niet een kaart
                op het dashboard. Het is een lijst die je afwerkt, geen
                getal dat je afleest. */}
            <NavItem to="/voorzieningen" icon={<IconTruck />} label="Containers" />

            <NavSection label="Werkbonnen" />
            <NavItem to="/werkbonnen"       icon={<IconMapPin />} label="Alle werkbonnen" />
            <NavItem to="/werkbonnen/nieuw" icon={<IconPlus />}   label="Nieuwe werkbon" />
            <NavItem to="/archief"          icon={<IconArchive />} label="Archief" />

            <NavSection label="Beheer" />
            <NavItem to="/rapporten"   icon={<IconFileExport />} label="Rapporten" />
            {magGebruikersBeheren && (
              <NavItem to="/medewerkers" icon={<IconUsers />} label="Medewerkers" />
            )}
            {/* De crashes van de app zelf. Beheer van het gereedschap,
                niet van het werk — en daarom alleen voor de eigenaar.
                Het slot dat telt zit in de database (migratie 030);
                dit voorkomt alleen dat iemand tegen een dichte deur
                loopt. */}
            {isEigenaar && (
              <NavItem to="/storingen" icon={<IconBug />} label="Storingen" />
            )}
          </>
        ) : (
          <>
            <NavSection label="Mijn werk" />
            <NavItem to="/mijn-werkbonnen" icon={<IconHome />}         label="Vandaag" />
            <NavItem to="/mijn-week"       icon={<IconCalendarWeek />} label="Mijn week" />
            <NavItem to="/mijn-bonnen"     icon={<IconClipboardList />} label="Mijn bonnen" />
          </>
        )}
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-3">
          {profile && <Avatar naam={profile.naam} size="sm" />}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{profile?.naam ?? '—'}</div>
            <div className="text-[11px] text-gray-400 dark:text-white/35 truncate">
              {profile?.functie || rolLabel(profile?.rol)}
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors"
            title={theme === 'dark' ? 'Licht thema' : 'Donker thema'}
          >
            {theme === 'dark' ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
          </button>
          <button onClick={handleSignOut} className="text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors" title="Uitloggen">
            <IconLogout className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
