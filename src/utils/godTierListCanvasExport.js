// src/utils/godTierListCanvasExport.js
/**
 * Canvas-based export for S/A/B/C/D/F god tier list.
 * Renders horizontal tier rows with god card images.
 */

// Helper: draw a rounded rectangle
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
}

// Truncate text to fit within maxWidth
function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text
    let t = text
    while (t.length > 0 && ctx.measureText(t + '...').width > maxWidth) {
        t = t.slice(0, -1)
    }
    return t + '...'
}

const TIERS = ['S', 'A', 'B', 'C', 'D', 'F']

const TIER_COLORS = {
    S: '#dc2626',
    A: '#ea580c',
    B: '#ca8a04',
    C: '#16a34a',
    D: '#2563eb',
    F: '#7c3aed',
}

// Preload images for all placed gods
async function preloadImages(godIds, godsMap) {
    const entries = godIds
        .map(id => godsMap.get(id))
        .filter(Boolean)

    const results = await Promise.all(
        entries.map(god => new Promise((resolve) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve({ id: god.id, img })
            img.onerror = () => resolve({ id: god.id, img: null })
            img.src = god.image_url
        }))
    )

    const map = new Map()
    for (const { id, img } of results) {
        if (img) map.set(id, img)
    }
    return map
}

export async function exportGodTierListAsImage(tiers, godsMap, filename = 'god-tierlist') {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const scale = window.devicePixelRatio || 2

    // Layout constants
    const WIDTH = 1400
    const PADDING = 30
    const TITLE_AREA = 80
    const LABEL_W = 70
    const GOD_SIZE = 64
    const GOD_GAP = 6
    const ROW_PAD_X = 12
    const ROW_PAD_Y = 10
    const ROW_GAP = 4
    const BOTTOM_PAD = 30
    const NAME_H = 14

    // Colors
    const BG = '#060d1a'
    const ROW_BG = '#101829'
    const TEXT_WHITE = '#ffffff'
    const TEXT_DIM = '#9ca3af'
    const BORDER = 'rgba(255,255,255,0.1)'
    const FONT_HEADING = '"Montserrat", system-ui, -apple-system, "Segoe UI", sans-serif'
    const FONT_BODY = '"Lato", system-ui, -apple-system, "Segoe UI", sans-serif'

    // Content area width for god cards
    const contentW = WIDTH - PADDING * 2 - LABEL_W - ROW_PAD_X * 2
    const godsPerRow = Math.floor((contentW + GOD_GAP) / (GOD_SIZE + GOD_GAP))

    // Collect all placed god IDs for preloading
    const allGodIds = TIERS.flatMap(t => tiers[t] || [])
    const imageMap = await preloadImages(allGodIds, godsMap)

    // Calculate row heights
    const rowHeights = {}
    for (const tier of TIERS) {
        const count = (tiers[tier] || []).length
        if (count === 0) {
            rowHeights[tier] = ROW_PAD_Y * 2 + GOD_SIZE + NAME_H
        } else {
            const rows = Math.ceil(count / godsPerRow)
            rowHeights[tier] = ROW_PAD_Y * 2 + rows * (GOD_SIZE + NAME_H + GOD_GAP) - GOD_GAP
        }
    }

    const totalRowsH = TIERS.reduce((sum, t) => sum + rowHeights[t] + ROW_GAP, 0) - ROW_GAP
    const HEIGHT = TITLE_AREA + totalRowsH + BOTTOM_PAD + PADDING

    canvas.width = WIDTH * scale
    canvas.height = HEIGHT * scale
    canvas.style.width = WIDTH + 'px'
    canvas.style.height = HEIGHT + 'px'
    ctx.scale(scale, scale)

    // Background
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    // Border
    ctx.strokeStyle = BORDER
    ctx.lineWidth = 1
    roundRect(ctx, 0.5, 0.5, WIDTH - 1, HEIGHT - 1, 16)
    ctx.stroke()

    // Title
    ctx.fillStyle = TEXT_WHITE
    ctx.font = `bold 28px ${FONT_HEADING}`
    ctx.textAlign = 'center'
    ctx.fillText('SMITE 2 God Tier List', WIDTH / 2, 44)

    ctx.fillStyle = TEXT_DIM
    ctx.font = `14px ${FONT_BODY}`
    ctx.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), WIDTH / 2, 68)

    // Tier rows
    let rowY = TITLE_AREA
    for (const tier of TIERS) {
        const rowH = rowHeights[tier]
        const gods = tiers[tier] || []
        const rowX = PADDING

        // Row background
        ctx.fillStyle = ROW_BG
        roundRect(ctx, rowX, rowY, WIDTH - PADDING * 2, rowH, 8)
        ctx.fill()
        ctx.strokeStyle = BORDER
        roundRect(ctx, rowX, rowY, WIDTH - PADDING * 2, rowH, 8)
        ctx.stroke()

        // Tier label
        ctx.fillStyle = TIER_COLORS[tier]
        roundRect(ctx, rowX, rowY, LABEL_W, rowH, 8)
        ctx.fill()
        // Cover right corners to make label flush with row
        ctx.fillRect(rowX + LABEL_W - 8, rowY, 8, rowH)

        ctx.fillStyle = TEXT_WHITE
        ctx.font = `bold 28px ${FONT_HEADING}`
        ctx.textAlign = 'center'
        ctx.fillText(tier, rowX + LABEL_W / 2, rowY + rowH / 2 + 10)

        // God cards
        if (gods.length === 0) {
            ctx.fillStyle = TEXT_DIM
            ctx.font = `italic 13px ${FONT_BODY}`
            ctx.textAlign = 'center'
            ctx.fillText('Empty', rowX + LABEL_W + (WIDTH - PADDING * 2 - LABEL_W) / 2, rowY + rowH / 2 + 5)
        } else {
            gods.forEach((godId, i) => {
                const col = i % godsPerRow
                const row = Math.floor(i / godsPerRow)
                const gx = rowX + LABEL_W + ROW_PAD_X + col * (GOD_SIZE + GOD_GAP)
                const gy = rowY + ROW_PAD_Y + row * (GOD_SIZE + NAME_H + GOD_GAP)

                const img = imageMap.get(godId)
                const god = godsMap.get(godId)

                // Card background
                ctx.fillStyle = '#1a2235'
                roundRect(ctx, gx, gy, GOD_SIZE, GOD_SIZE, 6)
                ctx.fill()

                // Draw god image
                if (img) {
                    ctx.save()
                    roundRect(ctx, gx, gy, GOD_SIZE, GOD_SIZE, 6)
                    ctx.clip()
                    ctx.drawImage(img, gx, gy, GOD_SIZE, GOD_SIZE)
                    ctx.restore()
                }

                // God name below image
                if (god) {
                    ctx.fillStyle = TEXT_DIM
                    ctx.font = `10px ${FONT_BODY}`
                    ctx.textAlign = 'center'
                    const name = truncateText(ctx, god.name, GOD_SIZE)
                    ctx.fillText(name, gx + GOD_SIZE / 2, gy + GOD_SIZE + 11)
                }
            })
        }

        rowY += rowH + ROW_GAP
    }

    // Watermark
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = `11px ${FONT_BODY}`
    ctx.textAlign = 'right'
    ctx.fillText('smitecomp.com', WIDTH - PADDING, HEIGHT - 14)

    // Export
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
    }, 'image/png')
}
