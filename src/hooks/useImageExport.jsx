// src/hooks/useImageExport.js
import { useCallback } from 'react'

/**
 * Custom hook for exporting DOM elements as images
 */
export const useImageExport = () => {
    const exportAsImage = useCallback(async (
        elementRef,
        filename = 'rankings',
        options = {}
    ) => {
        if (!elementRef.current) {
            console.error('Element reference is null')
            return
        }

        try {
            // Dynamic import of html2canvas to reduce bundle size
            const html2canvas = await import('html2canvas')

            const defaultOptions = {
                backgroundColor: '#f9fafb', // Match your bg-gray-50
                scale: 2, // Higher quality
                useCORS: true,
                allowTaint: true,
                width: elementRef.current.scrollWidth,
                height: elementRef.current.scrollHeight,
                scrollX: 0,
                scrollY: 0,
                logging: false, // Disable logging to reduce console noise
                // Handle modern CSS features that html2canvas doesn't support
                onclone: (clonedDoc) => {
                    // Replace modern CSS color functions with fallback colors
                    const style = clonedDoc.createElement('style')
                    style.textContent = `
            * {
              color: inherit !important;
            }
            .bg-gray-50 { background-color: #f9fafb !important; }
            .bg-white { background-color: #ffffff !important; }
            .bg-gray-100 { background-color: #f3f4f6 !important; }
            .bg-gray-200 { background-color: #e5e7eb !important; }
            .bg-blue-100 { background-color: #dbeafe !important; }
            .bg-blue-600 { background-color: #2563eb !important; }
            .bg-green-600 { background-color: #16a34a !important; }
            .text-gray-900 { color: #111827 !important; }
            .text-gray-600 { color: #4b5563 !important; }
            .text-gray-500 { color: #6b7280 !important; }
            .text-white { color: #ffffff !important; }
            .border-gray-300 { border-color: #d1d5db !important; }
            .border-blue-400 { border-color: #60a5fa !important; }
          `
                    clonedDoc.head.appendChild(style)
                },
                ...options
            }

            // Create canvas from the element
            const canvas = await html2canvas.default(elementRef.current, defaultOptions)

            // Convert to blob and download
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(url)
                }
            }, 'image/png', 0.95)

        } catch (error) {
            console.error('html2canvas failed (likely due to modern CSS features):', error.message)

            // Always throw to trigger fallback - html2canvas has issues with Tailwind 4.x
            throw new Error('html2canvas incompatible with Tailwind 4.x')
        }
    }, [])

    // Fallback method using native canvas (more limited but better browser support)
    const exportWithNativeCanvas = async (element, filename) => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // Get element dimensions
        const rect = element.getBoundingClientRect()
        canvas.width = rect.width * 2 // 2x for better quality
        canvas.height = rect.height * 2

        // Scale context for better quality
        ctx.scale(2, 2)

        // Set background
        ctx.fillStyle = '#f9fafb'
        ctx.fillRect(0, 0, rect.width, rect.height)

        // This is a simplified version - for full DOM rendering, html2canvas is needed
        ctx.fillStyle = '#000'
        ctx.font = '16px system-ui'
        ctx.fillText('Rankings Export', 20, 30)
        ctx.fillText('(Simplified fallback - install html2canvas for full rendering)', 20, 60)

        // Convert to blob and download
        canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `${filename}-fallback-${new Date().toISOString().slice(0, 10)}.png`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
            }
        }, 'image/png')
    }

    return { exportAsImage }
}