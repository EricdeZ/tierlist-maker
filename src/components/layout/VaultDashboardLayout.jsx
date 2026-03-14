import { Outlet } from 'react-router-dom'
import VaultDashboardNavbar from './VaultDashboardNavbar'

export default function VaultDashboardLayout() {
    return (
        <>
            <VaultDashboardNavbar />
            <div className="pt-20">
                <Outlet />
            </div>
        </>
    )
}
