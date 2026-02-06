// src/components/layout/AppLayout.jsx
import { Outlet } from 'react-router-dom'

const AppLayout = () => {
    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text)">
            <Outlet />
        </div>
    )
}

export default AppLayout