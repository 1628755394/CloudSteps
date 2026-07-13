import { ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AdminSidebar from './AdminSidebar'
import { Bell, Moon, Sun, Settings } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { useSidebar } from '@/contexts/SidebarContext'
import Button from '../UI/Button'

interface AdminLayoutProps {
  children: ReactNode
  title?: string
  description?: string
  actions?: ReactNode
}

const AdminLayout = ({ children, title, description, actions }: AdminLayoutProps) => {
  const { toggleMode, isDark } = useThemeStore()
  const { isCollapsed } = useSidebar()
  const navigate = useNavigate()
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminSidebar />
      
      {/* 主内容区 */}
      <div
        className="ling-main-with-sidebar transition-all duration-200 ease-in-out"
        style={{
          marginLeft: isDesktop ? (isCollapsed ? '80px' : '220px') : '0px',
        }}
      >
        {/* 顶部导航栏 */}
        <header className="sticky top-0 z-20 flex min-h-16 items-center border-b border-border bg-card px-4 sm:px-6 backdrop-blur-xl">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <img
                    src="/favicon.png"
                    alt="Logo"
                    className="w-6 h-6 object-contain"
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                {title && (
                  <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="relative"
                leftIcon={<Bell className="w-4 h-4" />}
                onClick={() => navigate('/notifications')}
              >
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMode}
                leftIcon={isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              />

              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Settings className="w-4 h-4" />}
                onClick={() => navigate('/settings')}
              />

              {actions}
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main style={{ padding: '16px 20px' }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout

