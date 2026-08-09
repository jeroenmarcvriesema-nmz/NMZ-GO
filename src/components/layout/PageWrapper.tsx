import { useNavigate } from 'react-router-dom'
import { IconLogout } from '@tabler/icons-react'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { Topbar, MobileTopbar } from './Topbar'
import { useAuth } from '@/hooks/useAuth'

interface PageWrapperProps {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function PageWrapper({ title, actions, children }: PageWrapperProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const handleSignOut = async () => { await signOut(); navigate('/login') }

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
      <div className="md:hidden">
        <MobileNav />
      </div>
      {/* Desktop heeft al een uitlog-knop onderin de Sidebar; dit vult het gat op mobiel, waar MobileNav geen uitlog-actie heeft. */}
      <button
        onClick={handleSignOut}
        title="Uitloggen"
        className="md:hidden fixed bottom-20 left-4 z-50 w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60 shadow-md hover:text-brand-yellow-dark dark:hover:text-brand-yellow hover:border-brand-yellow transition-colors"
      >
        <IconLogout className="w-4 h-4" />
      </button>
    </div>
  )
}
