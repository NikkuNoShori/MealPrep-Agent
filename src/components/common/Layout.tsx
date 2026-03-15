import { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { MeasurementSystemProvider } from '@/contexts/MeasurementSystemContext'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  useDocumentTitle()

  return (
    <MeasurementSystemProvider>
      <div className="h-screen flex flex-col bg-stone-50 dark:bg-[#0e0f13]">
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto relative z-10">{children}</main>
        <Footer />
      </div>
    </MeasurementSystemProvider>
  );
}

export default Layout
