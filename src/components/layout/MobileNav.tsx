import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useThemeStore } from '@/store/themeStore'
import { rolLabel } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import {
  IconLayoutDashboard,
  IconCalendarWeek,
  IconMapPin,
  IconClockExclamation,
  IconUsers,
  IconHome,
  IconClipboardList,
  IconDotsCircleHorizontal,
  IconArchive,
  IconFileExport,
  IconFolderOpen,
  IconSun,
  IconMoon,
  IconLogout,
  IconX,
  IconBug,
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

function MeerRegel({ icon, label, onClick, gevaarlijk }: {
  icon: React.ReactNode; label: string; onClick: () => void; gevaarlijk?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full min-h-[52px] px-4 rounded-lg text-left text-[15px] font-semibold transition-colors',
        gevaarlijk
          ? 'text-brand-red hover:bg-brand-red-light dark:hover:bg-brand-red/10'
          : 'text-gray-900 dark:text-white hover:bg-surface-2 dark:hover:bg-white/5'
      )}
    >
      <span className="text-[20px] leading-none flex-shrink-0 text-gray-400 dark:text-white/40">{icon}</span>
      <span className="flex-1 min-w-0 truncate">{label}</span>
    </button>
  )
}

/**
 * De navigatie op een telefoon: een tabbalk onderin plus een "Meer"-blad.
 *
 * Waarom geen hamburgermenu. Een hamburger is een webpatroon: hij
 * verstopt álles achter één knop, en op een telefoon betekent dat twee
 * tikken voor werk dat je twintig keer per dag doet. Elke app die
 * dagelijks gebruikt wordt — de bank, de mail, de kaart — heeft een
 * tabbalk onderin, met de vier dingen die ertoe doen binnen duimbereik.
 * Dát is wat een app als een app laat voelen.
 *
 * Wat overblijft gaat achter "Meer", zoals iOS en Android het ook doen.
 * Archief, rapporten en projecten zijn geen dagelijks werk maar iets wat
 * je één keer per week aan een bureau opzoekt; die mogen een tik extra
 * kosten. Zo krijg je één navigatie in plaats van drie naast elkaar.
 *
 * De uitlogknop zweefde eerst los boven de balk. Die hoort hier.
 */
export function MobileNav() {
  const { profile, magWerkBeheren, magGebruikersBeheren, isEigenaar, signOut } = useAuth()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const locatie = useLocation()
  const [meerOpen, setMeerOpen] = useState(false)

  // Van scherm wisselen sluit het blad. Zonder dit blijft het openstaan
  // over de pagina waar je net heen bent gegaan.
  useEffect(() => { setMeerOpen(false) }, [locatie.pathname])

  // Achter een open blad hoort de pagina niet mee te schuiven.
  useEffect(() => {
    if (!meerOpen) return
    const vorige = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const toets = (e: KeyboardEvent) => { if (e.key === 'Escape') setMeerOpen(false) }
    document.addEventListener('keydown', toets)
    return () => {
      document.body.style.overflow = vorige
      document.removeEventListener('keydown', toets)
    }
  }, [meerOpen])

  const ga = (pad: string) => { setMeerOpen(false); navigate(pad) }
  const uitloggen = async () => { setMeerOpen(false); await signOut(); navigate('/login') }

  return (
    <>
      {meerOpen && (
        <>
          <div
            onClick={() => setMeerOpen(false)}
            className="fixed inset-0 z-50 bg-black/40 animate-page-in"
            aria-hidden
          />
          {/* Een blad dat vanaf onderen komt, niet een paneel vanaf de
              zijkant: je duim zit onderaan het scherm. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Meer"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t-[3px] border-t-brand-yellow bg-white dark:bg-surface-dark-2 shadow-lg animate-page-in pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-white/10">
              {profile && <Avatar naam={profile.naam} size="sm" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {profile?.naam ?? '—'}
                </div>
                <div className="text-xs text-gray-400 dark:text-white/40 truncate">
                  {profile?.functie || rolLabel(profile?.rol)}
                </div>
              </div>
              <button
                onClick={() => setMeerOpen(false)}
                aria-label="Sluiten"
                className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-400 dark:text-white/40 hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2 space-y-0.5 max-h-[55vh] overflow-y-auto">
              {magWerkBeheren && (
                <>
                  {magGebruikersBeheren && (
                    <MeerRegel icon={<IconUsers />} label="Team" onClick={() => ga('/medewerkers')} />
                  )}
                  <MeerRegel icon={<IconArchive />} label="Archief" onClick={() => ga('/archief')} />
                  <MeerRegel icon={<IconFileExport />} label="Rapporten" onClick={() => ga('/rapporten')} />
                  <MeerRegel icon={<IconFolderOpen />} label="Projecten" onClick={() => ga('/projecten')} />
                  {/* Alleen de eigenaar; het echte slot zit in de
                      database (migratie 030). */}
                  {isEigenaar && (
                    <MeerRegel icon={<IconBug />} label="Storingen" onClick={() => ga('/storingen')} />
                  )}
                </>
              )}

              <MeerRegel
                icon={theme === 'dark' ? <IconSun /> : <IconMoon />}
                label={theme === 'dark' ? 'Licht thema' : 'Donker thema'}
                onClick={toggleTheme}
              />
              <MeerRegel icon={<IconLogout />} label="Uitloggen" onClick={uitloggen} gevaarlijk />
            </div>
          </div>
        </>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center gap-0.5 px-1 py-2 pb-safe bg-white dark:bg-surface-dark border-t border-gray-100 dark:border-white/10">
        {magWerkBeheren ? (
          <>
            <MobileNavItem to="/dashboard"  icon={<IconLayoutDashboard />}  label="Dashboard" />
            <MobileNavItem to="/planning"   icon={<IconCalendarWeek />}     label="Planning" />
            <MobileNavItem to="/werkbonnen" icon={<IconMapPin />}           label="Bonnen" />
            <MobileNavItem to="/uitloop"    icon={<IconClockExclamation />} label="Uitloop" />
          </>
        ) : (
          <>
            <MobileNavItem to="/mijn-werkbonnen" icon={<IconHome />}          label="Vandaag" />
            <MobileNavItem to="/mijn-week"       icon={<IconCalendarWeek />}  label="Mijn week" />
            <MobileNavItem to="/mijn-bonnen"     icon={<IconClipboardList />} label="Mijn bonnen" />
          </>
        )}

        <button
          onClick={() => setMeerOpen(true)}
          aria-label="Meer"
          aria-expanded={meerOpen}
          className={cn(
            'flex flex-col items-center gap-1 flex-1 min-w-0 px-1 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-all',
            meerOpen ? 'text-brand-yellow' : 'text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'
          )}
        >
          <span className="text-[22px] leading-none"><IconDotsCircleHorizontal /></span>
          <span className="truncate max-w-full">Meer</span>
        </button>
      </nav>
    </>
  )
}
