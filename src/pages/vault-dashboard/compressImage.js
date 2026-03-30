const MAX_BYTES = 1.8 * 1024 * 1024 // target under 2MB server limit

export default function compressImage(file) {
    if (file.size <= MAX_BYTES && file.type === 'image/webp') return Promise.resolve(file)
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
            const tryCompress = (maxDim, quality) => {
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
                const canvas = document.createElement('canvas')
                canvas.width = Math.round(img.width * scale)
                canvas.height = Math.round(img.height * scale)
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
                canvas.toBlob((blob) => {
                    if (blob.size > MAX_BYTES && quality > 0.4) {
                        tryCompress(maxDim * 0.75, quality - 0.15)
                    } else {
                        URL.revokeObjectURL(img.src)
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
                    }
                }, 'image/webp', quality)
            }
            tryCompress(2048, 0.85)
        }
        img.onerror = () => resolve(file)
        img.src = URL.createObjectURL(file)
    })
}
