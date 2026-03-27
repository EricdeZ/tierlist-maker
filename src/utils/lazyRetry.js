import { lazy } from 'react'

const GUARD_KEY = 'chunk-reload'

export default function lazyRetry(fn) {
    return lazy(() => fn().catch(() => {
        // Retry once after a brief delay (transient network failure).
        return new Promise(resolve => setTimeout(resolve, 1000))
            .then(fn)
            .catch(() => {
                // Stale deploy — chunk URL no longer exists.
                // Reload once to get fresh HTML. SessionStorage guard prevents loops.
                if (!sessionStorage.getItem(GUARD_KEY)) {
                    sessionStorage.setItem(GUARD_KEY, '1')
                    window.location.reload()
                    return new Promise(() => {})
                }
                // Already reloaded this session — let ErrorBoundary handle it.
                sessionStorage.removeItem(GUARD_KEY)
                throw new Error('Failed to load page after refresh. Please try again.')
            })
    }).then(module => {
        // Success — clear guard so future deploys can still auto-reload.
        sessionStorage.removeItem(GUARD_KEY)
        return module
    }))
}
