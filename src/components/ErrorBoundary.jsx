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
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-(--color-primary) flex items-center justify-center px-4">
                    <div className="text-center max-w-md">
                        <h1 className="font-heading text-5xl font-bold text-(--color-accent) mb-4">
                            Oops
                        </h1>
                        <p className="text-lg text-(--color-text) mb-2">
                            Something went wrong.
                        </p>
                        <p className="text-sm text-(--color-text-secondary) mb-6">
                            {this.state.error?.message || 'An unexpected error occurred.'}
                        </p>
                        <div className="flex gap-3 justify-center">
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
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary