import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { Topbar, MobileTopbar } from './Topbar'

interface PageWrapperProps {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function PageWrapper({ title, actions, children }: PageWrapperProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F4F3EF] dark:bg-surface-dark">
      {/* Naar de inhoud springen.
          Er was geen: wie met een toetsenbord werkt tabde op élke pagina
          eerst door zestien menu-items voordat hij bij het scherm zelf was.
          Alleen zichtbaar zodra hij focus krijgt — dat is het hele punt van
          zo'n link. */}
      <a
        href="#inhoud"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:px-4 focus:py-2.5 focus:rounded-sm focus:bg-brand-yellow focus:text-gray-900 focus:font-semibold focus:text-sm focus:shadow-md"
      >
        Naar de inhoud
      </a>
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="md:ml-60 flex flex-col min-h-screen min-w-0">
        <div className="hidden md:block">
          <Topbar title={title} actions={actions} />
        </div>
        <div className="md:hidden">
          <MobileTopbar title={title} actions={actions} />
        </div>
        <main id="inhoud" className="flex-1 min-w-0 p-4 sm:p-6 md:p-10 pb-24 md:pb-10 animate-page-in">
          {/* Een bovengrens aan de leesbreedte.
              Zonder die grens rekt elke pagina mee met het scherm: op een
              monitor van 1920 stond er duizend pixels lucht tussen een naam
              en de knop ernaast op /medewerkers, en werd een tekstveld voor
              een bonnummer van dertien tekens elfhonderd pixels breed.
              `WerkbonDetail` deed dit al goed met max-w-4xl; nu doet elk
              scherm het. `mx-auto` houdt het gecentreerd binnen de ruimte
              naast de zijbalk. */}
          <div className="max-w-[1400px] mx-auto w-full min-w-0">
            {children}
          </div>
        </main>
      </div>
      {/* De uitlogknop zweefde hier los boven de balk. Die staat nu in
          het "Meer"-blad van de navigatie, waar hij hoort. */}
      <div className="md:hidden">
        <MobileNav />
      </div>
    </div>
  )
}
