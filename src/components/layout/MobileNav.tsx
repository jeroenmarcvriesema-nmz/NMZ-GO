import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  IconLayoutDashboard,
  IconCalendarWeek,
  IconMapPin,
  IconClockExclamation,
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
          'flex flex-col items-center gap-1 flex-1 min-w-0 px-1 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-all',
          isActive ? 'text-brand-yellow' : 'text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'
        )
      }
    >
      <span className="text-[22px] leading-none">{icon}</span>
      <span className="truncate max-w-full">{label}</span>
    </NavLink>
  )
}

/**
 * De balk onderin op een telefoon.
 *
 * Hier zaten drie dingen mis, en alle drie waren ze alleen op een
 * telefoon te merken — precies het toestel waar dit op gebruikt wordt.
 *
 *   1. Werkbonnen stond er niet in. Kantoor kon op een telefoon dus
 *      helemaal niet bij de werkbonnen, en daarmee niet bij de
 *      weekkiezer, de syncknop of het importeren van een losse taak.
 *      Op de laptop stond hij wel in de zijbalk, dus het viel niet op.
 *
 *   2. "Team" werd getoond aan uitvoerders en werkvoorbereiders,
 *      terwijl die route alleen voor eigenaar en beheerder open staat.
 *      Erop tikken gooide je terug naar het dashboard. Een knop die je
 *      wegstuurt is erger dan geen knop.
 *
 *   3. Projecten nam een plek in terwijl die pagina leeg is: elke klus
 *      is een losse bon. Die plek is nu voor uitloop, waar wél iets
 *      staat waar je op moet handelen.
 *
 * Wat er bewust níet in staat: het archief. Terugzoeken wat er drie
 * jaar geleden op een adres is gedaan doe je aan een bureau, niet op
 * een trap. Hij staat in de zijbalk en is bereikbaar via /archief.
 */
export function MobileNav() {
  const { magWerkBeheren, magGebruikersBeheren } = useAuth()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center gap-0.5 px-1 py-2 pb-safe bg-white dark:bg-surface-dark border-t border-gray-100 dark:border-white/10">
      {magWerkBeheren ? (
        <>
          <MobileNavItem to="/dashboard"  icon={<IconLayoutDashboard />}  label="Dashboard" />
          <MobileNavItem to="/planning"   icon={<IconCalendarWeek />}     label="Planning" />
          <MobileNavItem to="/werkbonnen" icon={<IconMapPin />}           label="Bonnen" />
          <MobileNavItem to="/uitloop"    icon={<IconClockExclamation />} label="Uitloop" />
          {magGebruikersBeheren && (
            <MobileNavItem to="/medewerkers" icon={<IconUsers />} label="Team" />
          )}
        </>
      ) : (
        <>
          <MobileNavItem to="/mijn-werkbonnen" icon={<IconHome />}          label="Vandaag" />
          <MobileNavItem to="/mijn-week"       icon={<IconCalendarWeek />}  label="Mijn week" />
          <MobileNavItem to="/mijn-bonnen"     icon={<IconClipboardList />} label="Mijn bonnen" />
        </>
      )}
    </nav>
  )
}
