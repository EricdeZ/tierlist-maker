// Canvas-based PNG export for card previews
// Renders the preview DOM element to a downloadable PNG

export async function exportCardToPNG(previewElement, { width = 300, height = 420 } = {}) {
    const canvas = document.createElement('canvas')
    canvas.width = width * 2 // 2x for retina
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)

    // Draw background
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.roundRect(0, 0, width, height, 12)
    ctx.fill()

    // Convert DOM element to canvas via SVG foreignObject
    try {
        const clone = previewElement.cloneNode(true)
        // Remove any interactive elements and inline styles that won't serialize
        clone.querySelectorAll('button, input, select').forEach(el => el.remove())

        const svgData = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <foreignObject width="100%" height="100%">
                    <div xmlns="http://www.w3.org/1999/xhtml">
                        ${new XMLSerializer().serializeToString(clone)}
                    </div>
                </foreignObject>
            </svg>
        `
        const img = new Image()
        img.crossOrigin = 'anonymous'

        await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)
        })

        ctx.drawImage(img, 0, 0, width, height)
    } catch {
        // Fallback: render a placeholder
        ctx.fillStyle = '#ffffff'
        ctx.font = '16px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Card Preview', width / 2, height / 2)
    }

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
}

export function downloadBlob(blob, filename = 'card.png') {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
