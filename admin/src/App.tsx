import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary/ErrorBoundary'
import PWAInstaller from '@/components/PWA/PWAInstaller'
import NotificationContainer from '@/components/UI/NotificationContainer'
import GlobalSearch from '@/components/UI/GlobalSearch'
import DevErrorHandler from '@/components/Dev/DevErrorHandler'
import ProtectedRoute from '@/components/Auth/ProtectedRoute'
import AdminShell from '@/components/Layout/AdminShell'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { SiteConfigProvider } from '@/contexts/SiteConfigContext'
import { useAuthStore } from '@/stores/authStore'

const Login = lazy(() => import('@/pages/Login'))
const Settings = lazy(() => import('@/pages/Settings'))
const Profile = lazy(() => import('@/pages/Profile'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const Users = lazy(() => import('@/pages/Users'))
const OperationLogs = lazy(() => import('@/pages/OperationLogs'))
const LoginHistory = lazy(() => import('@/pages/LoginHistory'))
const WordBooks = lazy(() => import('@/pages/WordBooks'))
const WordBookWords = lazy(() => import('@/pages/WordBookWords'))
const VocabQuestions = lazy(() => import('@/pages/VocabQuestions'))
const VocabTestRecords = lazy(() => import('@/pages/VocabTestRecords'))
const Coaching = lazy(() => import('@/pages/Coaching'))

function App() {
  const { refreshUserInfo, isAuthenticated } = useAuthStore()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token && !isAuthenticated) {
      refreshUserInfo()
    }
  }, [])

  return (
    <ErrorBoundary>
      <SiteConfigProvider>
        <SidebarProvider>
          <Router>
            <div className="min-h-screen bg-background text-foreground">
              <Suspense
                fallback={
                  <div className="p-8 text-center text-muted-foreground text-sm">页面加载中...</div>
                }
              >
                <Routes>
                  <Route
                    path="/login"
                    element={isAuthenticated ? <Navigate to="/wordbooks" replace /> : <Login />}
                  />

                  <Route element={<ProtectedRoute />}>
                    <Route element={<AdminShell />}>
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/operation-logs" element={<OperationLogs />} />
                      <Route path="/login-history" element={<LoginHistory />} />
                      <Route path="/wordbooks" element={<WordBooks />} />
                      <Route path="/wordbooks/:id" element={<WordBookWords />} />
                      <Route path="/vocab-questions" element={<VocabQuestions />} />
                      <Route path="/vocab-records" element={<VocabTestRecords />} />
                      <Route path="/coaching" element={<Coaching />} />
                    </Route>
                  </Route>

                  <Route path="/" element={<Navigate to="/wordbooks" replace />} />
                  <Route path="*" element={<Navigate to="/wordbooks" replace />} />
                </Routes>
              </Suspense>

              <PWAInstaller showOnLoad={true} delay={5000} position="bottom-right" />
              <NotificationContainer />
              <DevErrorHandler />
              <GlobalSearch />
            </div>
          </Router>
        </SidebarProvider>
      </SiteConfigProvider>
    </ErrorBoundary>
  )
}

export default App
