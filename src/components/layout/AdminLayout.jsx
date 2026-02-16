import { Outlet } from 'react-router-dom'
import AdminNavbar from './AdminNavbar'

export default function AdminLayout() {
    return (
        <>
            <AdminNavbar />
            <div className="pt-20">
                <Outlet />
            </div>
        </>
    )
}
