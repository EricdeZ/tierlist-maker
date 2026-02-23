import { Outlet } from 'react-router-dom'
import CodexNavbar from './CodexNavbar'

export default function CodexLayout() {
    return (
        <>
            <CodexNavbar />
            <div className="pt-20">
                <Outlet />
            </div>
        </>
    )
}
