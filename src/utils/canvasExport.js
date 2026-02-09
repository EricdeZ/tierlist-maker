// src/utils/canvasExport.js
/**
 * Canvas-based export that matches the dark-themed page design.
 * Renders team-colored player cards with ranking numbers.
 */

import { getContrastColor } from './colorContrast'

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

// Helper: draw a rounded rectangle clipped to just the top corners
function roundRectTop(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
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

export const exportRankingsAsImage = (rankings, teams, filename = 'rankings', leagueName = 'Player Rankings') => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    const scale = window.devicePixelRatio || 2

    // --- Layout constants ---
    const WIDTH = 1400
    const PADDING = 40
    const TITLE_AREA = 90
    const COL_GAP = 12
    const COL_HEADER_H = 48
    const CARD_H = 40
    const CARD_GAP = 8
    const CARD_PAD_X = 10
    const LEGEND_TOP_PAD = 30
    const LEGEND_ROW_H = 28
    const BOTTOM_PAD = 30

    const roles = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']
    const colWidth = (WIDTH - PADDING * 2 - COL_GAP * 4) / 5

    // Calculate needed height based on tallest column
    const maxPlayers = Math.max(...roles.map(r => (rankings[r] || []).length), 1)
    const columnsBottom = TITLE_AREA + COL_HEADER_H + (maxPlayers * (CARD_H + CARD_GAP)) + CARD_GAP + 16

    // Legend sizing
    const teamsPerRow = Math.min(teams.length, 5)
    const legendRows = Math.ceil(teams.length / teamsPerRow)
    const legendH = 36 + legendRows * LEGEND_ROW_H + 16

    const HEIGHT = Math.max(700, columnsBottom + LEGEND_TOP_PAD + legendH + BOTTOM_PAD)

    canvas.width = WIDTH * scale
    canvas.height = HEIGHT * scale
    canvas.style.width = WIDTH + 'px'
    canvas.style.height = HEIGHT + 'px'
    ctx.scale(scale, scale)

    // --- Colors matching the page theme ---
    const BG = '#060d1a'           // --color-secondary
    const COL_BG = '#101829'       // --color-primary
    const COL_HEADER_BG = 'rgba(255,255,255,0.05)'
    const TEXT_WHITE = '#ffffff'
    const TEXT_DIM = '#9ca3af'
    const ACCENT = '#f8c56a'       // --color-accent
    const BORDER = 'rgba(255,255,255,0.1)'

    // Fonts (Montserrat for headings, Lato for body, with fallbacks)
    const FONT_HEADING = '"Montserrat", system-ui, -apple-system, "Segoe UI", sans-serif'
    const FONT_BODY = '"Lato", system-ui, -apple-system, "Segoe UI", sans-serif'

    // --- Background ---
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    // Subtle outer border
    ctx.strokeStyle = BORDER
    ctx.lineWidth = 1
    roundRect(ctx, 0.5, 0.5, WIDTH - 1, HEIGHT - 1, 16)
    ctx.stroke()

    // --- Title ---
    ctx.fillStyle = TEXT_WHITE
    ctx.font = `bold 28px ${FONT_HEADING}`
    ctx.textAlign = 'center'
    ctx.fillText(leagueName, WIDTH / 2, 48)

    // Subtitle / date
    ctx.fillStyle = TEXT_DIM
    ctx.font = `14px ${FONT_BODY}`
    ctx.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), WIDTH / 2, 72)

    // --- Role Columns ---
    roles.forEach((role, ci) => {
        const x = PADDING + ci * (colWidth + COL_GAP)
        const y = TITLE_AREA
        const playersInRole = rankings[role] || []
        const colH = COL_HEADER_H + Math.max(playersInRole.length, 1) * (CARD_H + CARD_GAP) + CARD_GAP + 12

        // Column background
        ctx.fillStyle = COL_BG
        roundRect(ctx, x, y, colWidth, colH, 10)
        ctx.fill()

        // Column border
        ctx.strokeStyle = BORDER
        ctx.lineWidth = 1
        roundRect(ctx, x, y, colWidth, colH, 10)
        ctx.stroke()

        // Column header background
        ctx.fillStyle = COL_HEADER_BG
        roundRectTop(ctx, x, y, colWidth, COL_HEADER_H, 10)
        ctx.fill()

        // Header divider line
        ctx.strokeStyle = BORDER
        ctx.beginPath()
        ctx.moveTo(x, y + COL_HEADER_H)
        ctx.lineTo(x + colWidth, y + COL_HEADER_H)
        ctx.stroke()

        // Role name
        ctx.fillStyle = TEXT_WHITE
        ctx.font = `bold 16px ${FONT_HEADING}`
        ctx.textAlign = 'center'
        ctx.fillText(role, x + colWidth / 2, y + COL_HEADER_H / 2 + 6)

        // Player cards
        if (playersInRole.length === 0) {
            ctx.fillStyle = TEXT_DIM
            ctx.font = `italic 13px ${FONT_BODY}`
            ctx.textAlign = 'center'
            ctx.fillText('No players ranked', x + colWidth / 2, y + COL_HEADER_H + 50)
        } else {
            playersInRole.forEach((player, pi) => {
                const cardX = x + CARD_PAD_X
                const cardY = y + COL_HEADER_H + CARD_GAP + pi * (CARD_H + CARD_GAP)
                const cardW = colWidth - CARD_PAD_X * 2

                // Get team color for this player
                const team = teams.find(t => t.players.includes(player))
                const teamColor = team ? team.color : '#6b7280'
                const textColor = getContrastColor(teamColor)

                // Card background (team color)
                ctx.fillStyle = teamColor
                roundRect(ctx, cardX, cardY, cardW, CARD_H, 6)
                ctx.fill()

                // Rank number badge (darker overlay on left)
                const badgeW = 30
                ctx.fillStyle = 'rgba(0,0,0,0.15)'
                // Clip to left rounded corners only
                ctx.save()
                roundRect(ctx, cardX, cardY, badgeW, CARD_H, 6)
                ctx.clip()
                ctx.fillRect(cardX, cardY, badgeW, CARD_H)
                ctx.restore()

                // Rank number text
                ctx.fillStyle = textColor
                ctx.font = `bold 14px ${FONT_HEADING}`
                ctx.textAlign = 'center'
                ctx.fillText(String(pi + 1), cardX + badgeW / 2, cardY + CARD_H / 2 + 5)

                // Player name
                ctx.fillStyle = textColor
                ctx.font = `600 14px ${FONT_BODY}`
                ctx.textAlign = 'left'
                const nameMaxW = cardW - badgeW - 14
                const displayName = truncateText(ctx, player, nameMaxW)
                ctx.fillText(displayName, cardX + badgeW + 8, cardY + CARD_H / 2 + 5)
            })
        }
    })

    // --- Team Legend ---
    const legendY = columnsBottom + LEGEND_TOP_PAD
    const legendX = PADDING
    const legendW = WIDTH - PADDING * 2

    // Legend container
    ctx.fillStyle = COL_BG
    roundRect(ctx, legendX, legendY, legendW, legendH, 10)
    ctx.fill()
    ctx.strokeStyle = BORDER
    roundRect(ctx, legendX, legendY, legendW, legendH, 10)
    ctx.stroke()

    // Legend title
    ctx.fillStyle = TEXT_DIM
    ctx.font = `bold 12px ${FONT_HEADING}`
    ctx.textAlign = 'center'
    ctx.letterSpacing = '1px'
    ctx.fillText('TEAM COLORS', WIDTH / 2, legendY + 24)
    ctx.letterSpacing = '0px'

    // Team entries
    const entryW = (legendW - 40) / teamsPerRow
    teams.forEach((team, i) => {
        const row = Math.floor(i / teamsPerRow)
        const col = i % teamsPerRow
        const ex = legendX + 20 + col * entryW
        const ey = legendY + 40 + row * LEGEND_ROW_H

        // Color swatch
        ctx.fillStyle = team.color
        roundRect(ctx, ex, ey, 18, 18, 4)
        ctx.fill()

        // Team name
        ctx.fillStyle = TEXT_WHITE
        ctx.font = `13px ${FONT_BODY}`
        ctx.textAlign = 'left'
        const maxNameW = entryW - 32
        const name = truncateText(ctx, team.name, maxNameW)
        ctx.fillText(name, ex + 24, ey + 13)
    })

    // --- Watermark ---
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = `11px ${FONT_BODY}`
    ctx.textAlign = 'right'
    ctx.fillText('SMITE 2 Companion', WIDTH - PADDING, HEIGHT - 14)

    // --- Export ---
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
