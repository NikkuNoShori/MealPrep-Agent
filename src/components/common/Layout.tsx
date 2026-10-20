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
      {/* h-full (100%) — the actual viewport-unit fix now lives on
          html/body/#root in index.css (set to 100svh directly at the
          root), since relying on viewport units only at this level while
          html/body stayed on a %-based height created two independent
          height sources that could disagree on real mobile engines
          (confirmed live 2026-10-19: both 100dvh and 100svh here, with
          html/body still on height:100%, left the chat composer fully
          missing on iOS Safari and Chrome on a Galaxy S26 Ultra, despite
          working in desktop Chrome's device emulation). With the root
          chain fixed, this div just inherits via percentage. */}
      <div className="h-full flex flex-col bg-surface-50 dark:bg-[rgb(var(--rs-page-bg-rgb))]">
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto relative z-10">{children}</main>
        {!hideFooter && <Footer />}
      </div>
    </MeasurementSystemProvider>
  );
}

export default Layout
