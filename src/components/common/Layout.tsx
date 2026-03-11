import { ReactNode } from 'react'
import Header from './Header'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { MeasurementSystemProvider } from '@/contexts/MeasurementSystemContext'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  useDocumentTitle()

  return (
    <MeasurementSystemProvider>
      <div className="h-screen flex flex-col bg-stone-50 dark:bg-[#0a0e1a] relative">
        {/* Ambient glow orbs */}
        <div className="glow-orb w-[600px] h-[600px] -top-64 -left-64 bg-primary-500/[0.07] dark:bg-primary-500/[0.04]" />
        <div className="glow-orb w-[500px] h-[500px] top-1/2 -right-48 bg-secondary-500/[0.05] dark:bg-secondary-500/[0.03]" />
        <div className="glow-orb w-[400px] h-[400px] -bottom-32 left-1/3 bg-primary-400/[0.04] dark:bg-primary-400/[0.02]" />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-grid dark:opacity-100 opacity-0 pointer-events-none" />

        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto relative z-10">{children}</main>
      </div>
    </MeasurementSystemProvider>
  );
}

export default Layout
