// src/utils/canvasExport.js
/**
 * Simple canvas-based export without external dependencies
 * Creates a styled rankings image using native Canvas API
 * Enhanced to match Tailwind design better
 */

export const exportRankingsAsImage = (rankings, teams, filename = 'rankings') => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    // Set canvas dimensions for high DPI displays
    const scale = window.devicePixelRatio || 1
    const width = 1400
    const height = 1000

    canvas.width = width * scale
    canvas.height = height * scale
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'

    ctx.scale(scale, scale)

    // Background (bg-gray-50)
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, 0, width, height)

    // Title
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 36px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Player Rankings', width / 2, 60)

    // Date
    ctx.font = '18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText(`Generated on ${new Date().toLocaleDateString()}`, width / 2, 90)

    // Role columns
    const roles = ['SOLO', 'JUNGLE', 'MID', 'SUPPORT', 'ADC']
    const columnWidth = (width - 140) / 5
    const startX = 70
    const startY = 130

    roles.forEach((role, columnIndex) => {
        const x = startX + (columnIndex * columnWidth)

        // Column background (white with shadow effect)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, startY, columnWidth - 15, 500)

        // Column shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
        ctx.fillRect(x + 3, startY + 3, columnWidth - 15, 500)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, startY, columnWidth - 15, 500)

        // Column border
        ctx.strokeStyle = '#e5e7eb'
        ctx.lineWidth = 1
        ctx.strokeRect(x, startY, columnWidth - 15, 500)

        // Column header background (bg-gray-100)
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(x, startY, columnWidth - 15, 50)

        // Column header border
        ctx.strokeStyle = '#d1d5db'
        ctx.strokeRect(x, startY, columnWidth - 15, 50)

        // Column header text
        ctx.fillStyle = '#111827'
        ctx.font = 'bold 20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(role, x + (columnWidth - 15) / 2, startY + 32)

        // Player cards in column
        const playersInRole = rankings[role] || []

        if (playersInRole.length === 0) {
            // Empty state text
            ctx.fillStyle = '#9ca3af'
            ctx.font = 'italic 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('Drop players here', x + (columnWidth - 15) / 2, startY + 200)
        } else {
            playersInRole.forEach((player, playerIndex) => {
                const cardY = startY + 70 + (playerIndex * 50)

                // Player card background
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(x + 8, cardY, columnWidth - 31, 40)

                // Player card border
                ctx.strokeStyle = '#d1d5db'
                ctx.lineWidth = 1
                ctx.strokeRect(x + 8, cardY, columnWidth - 31, 40)

                // Player name
                ctx.fillStyle = '#111827'
                ctx.font = '16px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
                ctx.textAlign = 'left'

                // Truncate long names
                const maxWidth = columnWidth - 45
                let displayName = player
                const textWidth = ctx.measureText(player).width
                if (textWidth > maxWidth) {
                    while (ctx.measureText(displayName + '...').width > maxWidth && displayName.length > 0) {
                        displayName = displayName.slice(0, -1)
                    }
                    displayName += '...'
                }

                ctx.fillText(displayName, x + 15, cardY + 25)
            })
        }
    })

    // Team colors legend at bottom
    let legendY = height - 180

    // Legend background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(50, legendY - 20, width - 100, 140)
    ctx.strokeStyle = '#e5e7eb'
    ctx.strokeRect(50, legendY - 20, width - 100, 140)

    ctx.fillStyle = '#111827'
    ctx.font = 'bold 20px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Team Colors', width / 2, legendY + 10)

    const teamsPerRow = 4
    teams.forEach((team, index) => {
        const row = Math.floor(index / teamsPerRow)
        const col = index % teamsPerRow
        const legendX = 80 + (col * (width - 160) / teamsPerRow)
        const currentY = legendY + 40 + (row * 30)

        // Team color box with border
        ctx.fillStyle = team.color
        ctx.fillRect(legendX, currentY - 18, 20, 20)
        ctx.strokeStyle = '#d1d5db'
        ctx.lineWidth = 1
        ctx.strokeRect(legendX, currentY - 18, 20, 20)

        // Team name
        ctx.fillStyle = '#111827'
        ctx.font = '14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'left'

        // Truncate team names if too long
        const maxTeamNameWidth = (width - 160) / teamsPerRow - 40
        let teamName = team.name
        const teamTextWidth = ctx.measureText(teamName).width
        if (teamTextWidth > maxTeamNameWidth) {
            while (ctx.measureText(teamName + '...').width > maxTeamNameWidth && teamName.length > 0) {
                teamName = teamName.slice(0, -1)
            }
            teamName += '...'
        }

        ctx.fillText(teamName, legendX + 25, currentY - 3)
    })

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
}