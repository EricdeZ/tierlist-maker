// PNG export for card previews using html-to-image
import { toPng } from 'html-to-image'

export async function exportCardToPNG(previewElement) {
    const blob = await toPng(previewElement, {
        width: 300,
        height: 420,
        pixelRatio: 2,
        // Filter out selection UI (resize handles, selection rings)
        filter: (node) => {
            if (node.dataset?.canvasBg) return false
            return true
        },
    }).then(dataUrl => fetch(dataUrl).then(r => r.blob()))

    return blob
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
