import { Outlet } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'

/** Persistent shell: sidebar stays mounted across protected page navigations. */
const AdminShell = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminSidebar />
      <Outlet />
    </div>
  )
}

export default AdminShell
