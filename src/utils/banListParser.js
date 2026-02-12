/**
 * Parse a structured ban list message from Discord into categories.
 *
 * Discord messages use markdown: **__Bold Underline__** for headers.
 * We strip all Discord markdown before parsing.
 */

// Known section headers that may not end with ":"
const KNOWN_HEADERS = [
    'item bans',
    'relic bans',
    'god bans',
    'aspect bans',
    'bug abuse',
    'pick at your own risk',
    'skin bans',
    'notes',
]

// Strip Discord markdown: **bold**, __underline__, *italic*, ~~strikethrough~~, `code`
function stripMarkdown(text) {
    return text
        .replace(/\*\*\__(.*?)__\*\*/g, '$1')  // **__text__**
        .replace(/\*\*(.*?)\*\*/g, '$1')        // **text**
        .replace(/__(.*?)__/g, '$1')             // __text__
        .replace(/\*(.*?)\*/g, '$1')             // *text*
        .replace(/~~(.*?)~~/g, '$1')             // ~~text~~
        .replace(/`(.*?)`/g, '$1')               // `text`
}

function isSectionHeader(stripped) {
    const lower = stripped.replace(/:$/, '').trim().toLowerCase()
    if (stripped.endsWith(':')) return true
    return KNOWN_HEADERS.includes(lower)
}

export function parseBanList(text) {
    if (!text) return { title: null, updated: null, sections: [] }

    const lines = text.split('\n').map(l => l.trim())
    const sections = []
    let title = null
    let updated = null
    let currentSection = null

    for (const rawLine of lines) {
        if (!rawLine) continue

        const line = stripMarkdown(rawLine).trim()
        if (!line) continue

        // Detect "Updated ..." line
        if (/^updated\s+\d/i.test(line)) {
            updated = line.replace(/^updated\s+/i, '').trim()
            continue
        }

        // Detect section headers
        if (isSectionHeader(line)) {
            const name = line.replace(/:$/, '').trim()
            currentSection = { name, items: [] }
            sections.push(currentSection)
            continue
        }

        // If no section yet, treat as title
        if (!currentSection) {
            if (!title) title = line
            continue
        }

        // Content line under current section
        currentSection.items.push(line)
    }

    return { title, updated, sections }
}
