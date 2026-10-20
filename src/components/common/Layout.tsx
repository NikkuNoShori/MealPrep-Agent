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
      {/* h-screen (100vh) is sized against the mobile browser's largest
          possible viewport (address bar collapsed), not what's actually
          visible — on phones that pushes content below the real fold with
          no way to scroll back to it (confirmed: Chat's composer/input box
          was invisible below the fold on mobile). 100dvh tracks the live
          visible viewport as browser chrome shows/hides. Tailwind's h-dvh
          utility needs v3.4+; this project is pinned to 3.3.3, so it's
          spelled out as an arbitrary value instead. */}
      <div className="h-screen h-[100dvh] flex flex-col bg-surface-50 dark:bg-[rgb(var(--rs-page-bg-rgb))]">
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto relative z-10">{children}</main>
        {!hideFooter && <Footer />}
      </div>
    </MeasurementSystemProvider>
  );
}

export default Layout
