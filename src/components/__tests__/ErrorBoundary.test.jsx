import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ErrorBoundary from '../ErrorBoundary'

// Suppress React error boundary console noise during tests
const originalError = console.error
beforeEach(() => {
    console.error = vi.fn()
})
afterEach(() => {
    console.error = originalError
})

function ThrowingChild({ shouldThrow = true }) {
    if (shouldThrow) throw new Error('Test explosion')
    return <div>Safe content</div>
}

function renderWithRouter(ui) {
    return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ErrorBoundary', () => {
    it('renders children when no error occurs', () => {
        renderWithRouter(
            <ErrorBoundary>
                <div>Normal content</div>
            </ErrorBoundary>
        )
        expect(screen.getByText('Normal content')).toBeInTheDocument()
    })

    it('shows fallback UI when a child throws', () => {
        renderWithRouter(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        )
        expect(screen.getByText('Oops')).toBeInTheDocument()
        expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
        expect(screen.getByText('Test explosion')).toBeInTheDocument()
    })

    it('shows generic message when error has no message', () => {
        function ThrowNull() {
            throw new Error()
        }
        renderWithRouter(
            <ErrorBoundary>
                <ThrowNull />
            </ErrorBoundary>
        )
        expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument()
    })

    it('has a Try Again button that resets the error state', () => {
        // We use a component that throws on first render but not after reset
        let shouldThrow = true
        function ConditionalThrow() {
            if (shouldThrow) throw new Error('Boom')
            return <div>Recovered</div>
        }

        renderWithRouter(
            <ErrorBoundary>
                <ConditionalThrow />
            </ErrorBoundary>
        )

        expect(screen.getByText('Oops')).toBeInTheDocument()

        // Stop throwing before clicking Try Again
        shouldThrow = false
        fireEvent.click(screen.getByText('Try Again'))

        expect(screen.getByText('Recovered')).toBeInTheDocument()
        expect(screen.queryByText('Oops')).not.toBeInTheDocument()
    })

    it('has a Back to Home link', () => {
        renderWithRouter(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        )
        const link = screen.getByRole('link', { name: /back to home/i })
        expect(link).toHaveAttribute('href', '/')
    })
})
