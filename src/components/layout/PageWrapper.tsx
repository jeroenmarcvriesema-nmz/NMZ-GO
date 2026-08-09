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
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-10 pb-24 md:pb-10 animate-page-in">
          {children}
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
