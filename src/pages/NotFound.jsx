// src/pages/NotFound.jsx
import { Link } from 'react-router-dom'
import PageTitle from '../components/PageTitle'

const NotFound = () => {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <PageTitle title="Page Not Found" noindex />
            <div className="text-center">
                <h1 className="font-heading text-6xl font-bold text-(--color-accent) mb-4">404</h1>
                <p className="text-xl text-(--color-text) mb-6">Page not found</p>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-(--color-accent) text-(--color-primary) rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                    ← Back to Home
                </Link>
            </div>
        </div>
    )
}

export default NotFound