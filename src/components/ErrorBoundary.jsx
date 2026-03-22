// src/components/ErrorBoundary.jsx
import { Component } from 'react'
import { Link } from 'react-router-dom'

class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo)
        // Auto-reload once on chunk load failures (stale deploy)
        if (this.isChunkError(error)) {
            const reloadCount = parseInt(sessionStorage.getItem('chunk-reload') || '0', 10)
            if (reloadCount < 1) {
                sessionStorage.setItem('chunk-reload', String(reloadCount + 1))
                // Cache-bust to ensure fresh index.html
                const url = new URL(window.location.href)
                url.searchParams.set('_cb', Date.now())
                window.location.replace(url.toString())
                return
            }
        }
    }

    componentDidMount() {
        // Reset reload counter on successful render
        sessionStorage.removeItem('chunk-reload')
    }

    isChunkError(error) {
        const msg = error?.message || ''
        return msg.includes('Failed to fetch dynamically imported module') ||
            msg.includes('Loading chunk') ||
            msg.includes('Loading CSS chunk') ||
            (error?.name === 'TypeError' && msg.includes('importing a module')) ||
            (error?.name === 'TypeError' && msg.includes("reading 'default'"))
    }

    render() {
        if (this.state.hasError) {
            const isChunk = this.isChunkError(this.state.error)
            return (
                <div className="min-h-screen bg-(--color-primary) flex items-center justify-center px-4">
                    <div className="text-center max-w-md">
                        <h1 className="font-heading text-5xl font-bold text-(--color-accent) mb-4">
                            {isChunk ? 'Update Available' : 'Oops'}
                        </h1>
                        <p className="text-lg text-(--color-text) mb-2">
                            {isChunk ? 'A new version has been deployed.' : 'Something went wrong.'}
                        </p>
                        <p className="text-sm text-(--color-text-secondary) mb-6">
                            {isChunk
                                ? 'Reload the page to get the latest version.'
                                : (this.state.error?.message || 'An unexpected error occurred.')}
                        </p>
                        <div className="flex gap-3 justify-center">
                            {isChunk ? (
                                <button
                                    onClick={() => {
                                        sessionStorage.removeItem('chunk-reload')
                                        const url = new URL(window.location.href)
                                        url.searchParams.set('_cb', Date.now())
                                        window.location.replace(url.toString())
                                    }}
                                    className="px-5 py-2.5 bg-(--color-accent) text-(--color-primary) rounded-lg font-semibold hover:opacity-90 transition-opacity"
                                >
                                    Reload Page
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => this.setState({ hasError: false, error: null })}
                                        className="px-5 py-2.5 bg-white/10 text-(--color-text) rounded-lg font-semibold hover:bg-white/20 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                    <Link
                                        to="/"
                                        onClick={() => this.setState({ hasError: false, error: null })}
                                        className="px-5 py-2.5 bg-(--color-accent) text-(--color-primary) rounded-lg font-semibold hover:opacity-90 transition-opacity"
                                    >
                                        ← Back to Home
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary