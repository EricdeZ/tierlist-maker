const DISCORD_CDN = 'https://cdn.discordapp.com/avatars'
const GOD_CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75'

/** Build Discord avatar URL */
export function getDiscordAvatarUrl(discordId, discordAvatar, size = 256) {
    if (!discordId || !discordAvatar) return null
    return `${DISCORD_CDN}/${discordId}/${discordAvatar}.webp?size=${size}`
}

/** Convert god display name to CDN image key (strip non-alphanumeric) */
export function godNameToImageKey(godName) {
    if (!godName) return null
    return godName.replace(/[^a-zA-Z0-9]/g, '')
}

/** Build god card art URL from god name or imageKey */
export function getGodCardUrl(godNameOrKey, size = 256) {
    if (!godNameOrKey) return null
    const key = godNameToImageKey(godNameOrKey)
    return `${GOD_CDN.replace('width=256', `width=${size}`)}/Gods/${key}/Default/t_GodCard_${key}.png`
}

/** Extract 1-2 character initials from a player name */
export function getPlayerInitials(name) {
    if (!name) return '?'
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
