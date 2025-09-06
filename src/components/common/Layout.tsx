import { ReactNode } from 'react'
import Header from './Header'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}

export default Layout
