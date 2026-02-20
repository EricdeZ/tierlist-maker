import { RANK_LABELS } from '../../utils/divisionImages'

export const PICK_MODES = [
    { value: 'regular', label: 'Regular' },
    { value: 'fearless', label: 'Fearless' },
    { value: 'fearless_picks', label: 'Fearless Picks' },
    { value: 'fearless_bans', label: 'Fearless Bans' },
]

export const XP_PICK_BADGE = {
    regular: 'xp-badge-blue',
    fearless: 'xp-badge-red',
    fearless_picks: 'xp-badge-orange',
    fearless_bans: 'xp-badge-purple',
}

export function formatPickMode(mode) {
    return PICK_MODES.find(m => m.value === mode)?.label || mode
}

export function formatDateEST(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }) + ' EST'
}

export function formatRelativeDate(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date - now
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays > 1) return `in ${diffDays} days`
    if (diffDays === 1) return 'tomorrow'
    if (diffHours > 1) return `in ${diffHours} hours`
    if (diffHours === 1) return 'in 1 hour'
    return 'soon'
}

export function formatScrimForClipboard(s, myTeamIds) {
    const tierLabel = (tier) => tier ? (RANK_LABELS[tier] || 'Tier ' + tier) : ''

    // Figure out which side is "me" vs "enemy"
    const iAmPoster = myTeamIds && myTeamIds.has(s.teamId)
    const iAmAccepter = myTeamIds && s.acceptedTeamId && myTeamIds.has(s.acceptedTeamId)

    let my, enemy
    if (iAmAccepter && !iAmPoster) {
        my = { team: s.acceptedTeamName, league: s.acceptedLeagueName, div: s.acceptedDivisionName, tier: s.acceptedDivisionTier }
        enemy = { team: s.teamName, league: s.leagueName, div: s.divisionName, tier: s.divisionTier }
    } else {
        my = { team: s.teamName, league: s.leagueName, div: s.divisionName, tier: s.divisionTier }
        enemy = s.acceptedTeamName
            ? { team: s.acceptedTeamName, league: s.acceptedLeagueName, div: s.acceptedDivisionName, tier: s.acceptedDivisionTier }
            : s.challengedTeamName
                ? { team: s.challengedTeamName, league: s.challengedLeagueName, div: s.challengedDivisionName, tier: null }
                : null
    }

    const lines = []
    lines.push(`My Team: ${my.team}`)
    lines.push(`My League: ${my.league || 'N/A'}`)
    lines.push(`My Division: ${my.div || 'N/A'}${my.tier ? ` (${tierLabel(my.tier)})` : ''}`)
    if (enemy) {
        lines.push(`Enemy Team: ${enemy.team}`)
        lines.push(`Enemy League: ${enemy.league || 'N/A'}`)
        lines.push(`Enemy Division: ${enemy.div || 'N/A'}${enemy.tier ? ` (${tierLabel(enemy.tier)})` : ''}`)
    }
    lines.push(`Date: ${formatDateEST(s.scheduledDate)}`)
    lines.push(`Mode: ${formatPickMode(s.pickMode)}`)
    if (s.bannedContentLeague) lines.push(`Bans: ${s.bannedContentLeague}`)
    if (s.notes) lines.push(`Notes: ${s.notes}`)
    return lines.join('\n')
}

let _toastTimer = null
export function showCopiedToast() {
    let el = document.getElementById('xp-copy-toast')
    if (!el) {
        el = document.createElement('div')
        el.id = 'xp-copy-toast'
        el.className = 'xp-copy-toast'
        document.body.appendChild(el)
    }
    el.textContent = 'Copied to clipboard!'
    el.classList.add('xp-copy-toast-visible')
    clearTimeout(_toastTimer)
    _toastTimer = setTimeout(() => el.classList.remove('xp-copy-toast-visible'), 2000)
}

export async function copyScrimsToClipboard(scrims, myTeamIds) {
    const text = scrims.map(s => formatScrimForClipboard(s, myTeamIds)).join('\n\n') + '\n\nhttps://smitecomp.com/scrims'
    await navigator.clipboard.writeText(text)
    showCopiedToast()
}
