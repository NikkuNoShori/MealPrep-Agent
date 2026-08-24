import { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { MeasurementSystemProvider } from '@/contexts/MeasurementSystemContext'

interface LayoutProps {
  children: ReactNode
  /**
   * Skip rendering the Footer. Vertical space is scarce on mobile viewports,
   * and pages that manage their own full-height scroll region (currently
   * just Chat) need every pixel between the Header and the screen edge.
   */
  hideFooter?: boolean
}

const Layout: React.FC<LayoutProps> = ({ children, hideFooter }) => {
  useDocumentTitle()

  return (
    <MeasurementSystemProvider>
      <div className="h-screen flex flex-col bg-stone-50 dark:bg-[#0e0f13]">
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto relative z-10">{children}</main>
        {!hideFooter && <Footer />}
      </div>
    </MeasurementSystemProvider>
  );
}

export default Layout
