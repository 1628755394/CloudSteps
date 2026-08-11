import { useState, useEffect, useRef, useMemo, memo } from 'react'
import faviconUrl from '/favicon.png'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  User as UserIcon,
  Users,
  History,
  FileText,
  Lock,
  Library,
  FlaskConical,
  Brain,
  CalendarDays,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useSidebar } from '@/contexts/SidebarContext'
import { useSiteConfig } from '@/contexts/SiteConfigContext'
import { buildLogoUrl } from '@/utils/logoUrl'
import { cn } from '@/utils/cn'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
  children?: NavItem[]
}

const NAVIGATION: NavItem[] = [
  { name: '用户管理', href: '/users', icon: Users },
  { name: '词库管理', href: '/wordbooks', icon: Library },
  {
    name: '题库管理',
    href: '/quiz',
    icon: FlaskConical,
    children: [
      { name: '词汇测评题库', href: '/vocab-questions', icon: Brain },
      { name: '测试记录', href: '/vocab-records', icon: FileText },
    ],
  },
  { name: '一对一陪练', href: '/coaching', icon: CalendarDays },
  {
    name: '安全管理',
    href: '/security',
    icon: Lock,
    children: [
      { name: '操作日志', href: '/operation-logs', icon: FileText },
      { name: '登录历史', href: '/login-history', icon: History },
    ],
  },
  { name: '系统设置', href: '/settings', icon: Settings },
]

const AdminSidebar = memo(function AdminSidebar() {
  const { isCollapsed, toggleCollapse } = useSidebar()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { config } = useSiteConfig()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const siteName = config?.SITE_NAME || '云阶管理'
  const logoUrl = config?.SITE_LOGO_URL || faviconUrl

  const isPathActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const isItemActive = (item: NavItem) => {
    if (item.children?.length) {
      return item.children.some((child) => isPathActive(child.href))
    }
    return isPathActive(item.href)
  }

  useEffect(() => {
    const parents = NAVIGATION.filter((item) =>
      item.children?.some((child) => isPathActive(child.href))
    ).map((item) => item.name)
    if (parents.length === 0) return
    setExpandedItems((prev) => {
      const next = new Set(prev)
      parents.forEach((name) => next.add(name))
      return Array.from(next)
    })
    setIsMobileOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const toggleExpand = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    )
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const userLabel = useMemo(
    () => user?.displayName || user?.email || '管理员',
    [user?.displayName, user?.email]
  )

  const SidebarContent = ({ showLogo = true }: { showLogo?: boolean }) => {
    const { config: sidebarConfig } = useSiteConfig()
    const currentSiteName = sidebarConfig?.SITE_NAME || '云阶管理后台'
    const sidebarLogoUrl = sidebarConfig?.SITE_LOGO_URL
      ? buildLogoUrl(sidebarConfig.SITE_LOGO_URL)
      : faviconUrl

    return (
      <>
        {showLogo && (
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            {!isCollapsed && (
              <Link to="/wordbooks" className="flex items-center gap-3 group min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <img
                    src={sidebarLogoUrl}
                    alt={currentSiteName}
                    className="w-6 h-6 object-contain"
                  />
                </div>
                <span className="font-semibold text-[17px] text-foreground truncate">
                  {currentSiteName}
                </span>
              </Link>
            )}
            {isCollapsed && (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto bg-primary/10">
                <img
                  src={sidebarLogoUrl}
                  alt={currentSiteName}
                  className="w-6 h-6 object-contain"
                />
              </div>
            )}
            <button
              type="button"
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent text-muted-foreground transition-colors"
              title={isCollapsed ? '展开' : '折叠'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 ling-sidebar-nav overflow-y-auto">
          {NAVIGATION.map((item) => {
            const Icon = item.icon
            const hasChildren = Boolean(item.children?.length)
            const isExpanded = expandedItems.includes(item.name)
            const itemActive = isItemActive(item)

            if (hasChildren) {
              return (
                <div key={item.name}>
                  <button
                    type="button"
                    onClick={() => !isCollapsed && toggleExpand(item.name)}
                    className={cn(
                      'ling-sidebar-nav-item',
                      itemActive && 'ling-sidebar-nav-item--active',
                      isCollapsed && 'ling-sidebar-nav-item--compact justify-center'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </div>
                    {!isCollapsed && (
                      <ChevronRight
                        className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
                      />
                    )}
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && !isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-4 mt-1 space-y-1 border-l-2 border-border pl-4 overflow-hidden"
                      >
                        {item.children?.map((child) => {
                          const ChildIcon = child.icon
                          const childActive = isPathActive(child.href)
                          return (
                            <Link
                              key={child.name}
                              to={child.href}
                              className={cn(
                                'ling-sidebar-nav-item text-sm',
                                childActive && 'ling-sidebar-nav-item--active'
                              )}
                            >
                              <ChildIcon className="w-4 h-4" />
                              <span>{child.name}</span>
                            </Link>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            }

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'ling-sidebar-nav-item',
                  itemActive && 'ling-sidebar-nav-item--active',
                  isCollapsed && 'ling-sidebar-nav-item--compact justify-center'
                )}
                title={isCollapsed ? item.name : ''}
              >
                <Icon className="w-5 h-5" />
                {!isCollapsed && <span className="flex-1">{item.name}</span>}
                {item.badge && !isCollapsed && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary/12 text-[hsl(var(--primary-deep))] rounded-md">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {!isCollapsed && (
          <div className="px-3 py-4 border-t border-border">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-accent transition-colors"
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-foreground truncate">{userLabel}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email || 'admin@example.com'}
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    showDropdown && 'rotate-90'
                  )}
                />
              </button>

              {showDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-xl shadow-soft-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false)
                      navigate('/profile')
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">个人中心</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false)
                      handleLogout()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">退出登录</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-card shadow-rest border border-border"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/40 z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-70 bg-background border-r border-border shadow-soft-lg z-50 flex flex-col"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <img src={logoUrl} alt={siteName} className="w-6 h-6 object-contain" />
                  </div>
                  <span className="font-semibold text-lg text-foreground">{siteName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="p-2 rounded-lg hover:bg-accent"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <SidebarContent showLogo={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 220 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-30 bg-background border-r border-border"
      >
        <SidebarContent showLogo={true} />
      </motion.aside>
    </>
  )
})

export default AdminSidebar
