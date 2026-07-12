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
    <div style={{ minHeight: '100vh', backgroundColor: '#F4F3EF' }}>
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="md:ml-60 flex flex-col min-h-screen">
        <div className="hidden md:block">
          <Topbar title={title} actions={actions} />
        </div>
        <div className="md:hidden">
          <MobileTopbar title={title} />
        </div>
        <main className="flex-1 p-5 md:p-8 pb-24 md:pb-10">
          {children}
        </main>
      </div>
      <div className="md:hidden">
        <MobileNav />
      </div>
    </div>
  )
}