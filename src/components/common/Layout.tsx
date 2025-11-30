import { ReactNode } from 'react'
import Header from './Header'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  useDocumentTitle()
  
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-primary-50/20 to-secondary-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <Header />
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}

export default Layout
