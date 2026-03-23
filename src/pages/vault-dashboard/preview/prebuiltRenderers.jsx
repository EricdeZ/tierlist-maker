export const ROLES = ['adc', 'solo', 'jungle', 'mid', 'support', 'staff', 'cheerleader']

export const ROLE_PALETTES = {
    adc:         { accent: '#c4884a', accentLight: '#e0a866', accentDark: '#8a5c2a', bodyBg: '#1e1810', bodySurface: '#2a2018', bodyBorder: '#4a3828', textBright: '#fff', textDim: '#9a8a70' },
    solo:        { accent: '#4a8ec4', accentLight: '#66b0e0', accentDark: '#2a5c8a', bodyBg: '#10161e', bodySurface: '#182230', bodyBorder: '#283a50', textBright: '#fff', textDim: '#708a9a' },
    jungle:      { accent: '#4ab868', accentLight: '#66d884', accentDark: '#2a7a3e', bodyBg: '#101e14', bodySurface: '#18301e', bodyBorder: '#285038', textBright: '#fff', textDim: '#709a7a' },
    mid:         { accent: '#9a5cc4', accentLight: '#b878e0', accentDark: '#6a3a8a', bodyBg: '#1a101e', bodySurface: '#261830', bodyBorder: '#402850', textBright: '#fff', textDim: '#8a709a' },
    support:     { accent: '#4aaab8', accentLight: '#66c8d4', accentDark: '#2a7a84', bodyBg: '#101c1e', bodySurface: '#182a30', bodyBorder: '#284a50', textBright: '#fff', textDim: '#70949a' },
    staff:       { accent: '#c4a84a', accentLight: '#e0c866', accentDark: '#8a7a2a', bodyBg: '#1e1c10', bodySurface: '#2a2818', bodyBorder: '#4a4428', textBright: '#fff', textDim: '#9a9470' },
    cheerleader: { accent: '#c44a72', accentLight: '#e06690', accentDark: '#8a2a4e', bodyBg: '#1e1014', bodySurface: '#2a1820', bodyBorder: '#4a2838', textBright: '#fff', textDim: '#9a7080' },
}

// Staff theme variants — keyed by theme name, same shape as ROLE_PALETTES entries
export const STAFF_THEMES = {
    gold:     ROLE_PALETTES.staff,
    silver:   { accent: '#8a8a9a', accentLight: '#b0b0c0', accentDark: '#5a5a6a', bodyBg: '#141418', bodySurface: '#1e1e24', bodyBorder: '#38384a', textBright: '#fff', textDim: '#808090' },
    crimson:  { accent: '#c44a4a', accentLight: '#e06666', accentDark: '#8a2a2a', bodyBg: '#1e1010', bodySurface: '#2a1818', bodyBorder: '#4a2828', textBright: '#fff', textDim: '#9a7070' },
    navy:     { accent: '#4a5cc4', accentLight: '#6678e0', accentDark: '#2a3a8a', bodyBg: '#10101e', bodySurface: '#181830', bodyBorder: '#283050', textBright: '#fff', textDim: '#70709a' },
    emerald:  { accent: '#2a8a5c', accentLight: '#40b878', accentDark: '#1a6a40', bodyBg: '#0e1a14', bodySurface: '#16261e', bodyBorder: '#264a38', textBright: '#fff', textDim: '#6a9a80' },
    cream:    { accent: '#8a6a30', accentLight: '#6a5020', accentDark: '#b08840', bodyBg: '#f5f0e8', bodySurface: '#ece4d8', bodyBorder: '#d0c4a8', textBright: '#2a2418', textDim: '#6a6050' },
    slate:    { accent: '#4a6080', accentLight: '#344868', accentDark: '#6080a0', bodyBg: '#e8ecf0', bodySurface: '#dce2e8', bodyBorder: '#b0bcc8', textBright: '#1a2030', textDim: '#5a6878' },
    blush:    { accent: '#a05070', accentLight: '#804060', accentDark: '#c06888', bodyBg: '#f8f0f2', bodySurface: '#f0e4e8', bodyBorder: '#d8c0c8', textBright: '#2a1820', textDim: '#7a5a68' },
}

export function getResolvedPalette(el) {
    if (el.role === 'staff' && el.theme && STAFF_THEMES[el.theme]) {
        return STAFF_THEMES[el.theme]
    }
    return ROLE_PALETTES[el.role] || ROLE_PALETTES.adc
}

function hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${opacity})`
}

const PREBUILT_TYPES = new Set(['name-banner', 'stats-block', 'text-block', 'subtitle', 'footer'])

export function isPrebuiltType(type) {
    return PREBUILT_TYPES.has(type)
}

export function renderPrebuiltContent(el) {
    const p = getResolvedPalette(el)
    const font = el.font || "'Segoe UI', system-ui, sans-serif"
    const bgO = el.bgOpacity ?? 1

    switch (el.type) {
        case 'name-banner':
            return (
                <div className="pointer-events-none" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: hexToRgba(p.bodyBg, bgO),
                    gap: 6,
                }}>
                    <span style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: el.fontSize ?? 16,
                        fontWeight: 800,
                        color: el.nameColor || p.textBright,
                        letterSpacing: 0.4,
                        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.2,
                        fontFamily: font,
                    }}>
                        {el.playerName || 'Name'}
                    </span>
                    <span style={{
                        fontSize: el.fontSize ? Math.round(el.fontSize * 0.56) : 9,
                        fontWeight: 700,
                        color: p.accentLight,
                        textTransform: 'uppercase',
                        letterSpacing: 1.5,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                    }}>
                        {el.roleLabel || ''}
                    </span>
                </div>
            )

        case 'stats-block': {
            const rows = el.rows || []
            const record = el.record || {}
            const hasRecord = el.showRecord !== false && (record.winRate || record.record || record.games)
            return (
                <div className="pointer-events-none" style={{
                    background: hexToRgba(p.bodySurface, bgO),
                    border: `1px solid ${hexToRgba(p.bodyBorder, bgO)}`,
                    borderRadius: 5,
                    padding: '5px 8px',
                    fontFamily: font,
                }}>
                    {rows.map((row, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '3px 0',
                            borderBottom: i < rows.length - 1 ? `1px solid ${p.bodyBorder}` : 'none',
                        }}>
                            <div>
                                <div style={{ fontSize: el.fontSize ?? 10, fontWeight: 700, color: p.accentLight }}>{row.label}</div>
                                {row.sub && <div style={{ fontSize: (el.fontSize ?? 10) - 2, color: p.textDim }}>{row.sub}</div>}
                            </div>
                            <span style={{
                                fontSize: (el.fontSize ?? 10) + 2,
                                fontWeight: 900,
                                color: p.textBright,
                                textShadow: `0 0 8px ${p.accent}40`,
                            }}>
                                {row.value}
                            </span>
                        </div>
                    ))}
                    {hasRecord && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-around',
                            borderTop: `1px solid ${p.bodyBorder}`,
                            marginTop: 3,
                            paddingTop: 4,
                        }}>
                            {record.winRate && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: (el.fontSize ?? 10) + 1, fontWeight: 800, color: p.textBright }}>{record.winRate}</div>
                                    <div style={{ fontSize: 7, color: p.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>WR</div>
                                </div>
                            )}
                            {record.record && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: (el.fontSize ?? 10) + 1, fontWeight: 800, color: p.textBright }}>{record.record}</div>
                                    <div style={{ fontSize: 7, color: p.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Record</div>
                                </div>
                            )}
                            {record.games && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: (el.fontSize ?? 10) + 1, fontWeight: 800, color: p.textBright }}>{record.games}</div>
                                    <div style={{ fontSize: 7, color: p.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Games</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        }

        case 'text-block':
            return (
                <div className="pointer-events-none" style={{
                    background: hexToRgba(p.bodySurface, bgO),
                    border: `1px solid ${hexToRgba(p.bodyBorder, bgO)}`,
                    borderRadius: 5,
                    padding: '6px 10px',
                    fontFamily: font,
                    height: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                }}>
                    {el.title && (
                        <div style={{
                            fontSize: (el.fontSize ?? 10) + 1,
                            fontWeight: 700,
                            color: p.accentLight,
                            lineHeight: 1.2,
                            marginBottom: 3,
                        }}>
                            {el.title}
                        </div>
                    )}
                    <div style={{
                        fontSize: el.fontSize ?? 10,
                        color: el.color || p.textDim,
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap',
                    }}>
                        {el.content || 'Text content'}
                    </div>
                </div>
            )

        case 'subtitle':
            return (
                <div className="pointer-events-none" style={{
                    padding: '6px 14px',
                    textAlign: 'center',
                    lineHeight: 1,
                    background: el.showBg ? hexToRgba(p.bodyBg, bgO) : 'transparent',
                }}>
                    <span style={{
                        fontSize: el.fontSize ?? 9,
                        fontWeight: 600,
                        color: el.color || p.textDim,
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        fontFamily: font,
                    }}>
                        {el.text || 'Subtitle'}
                    </span>
                </div>
            )

        case 'footer':
            return (
                <div className="pointer-events-none" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 14px 8px',
                    background: el.showBg ? hexToRgba(p.bodyBg, bgO) : 'transparent',
                }}>
                    <span style={{
                        fontSize: el.fontSize ?? 9,
                        color: p.textDim,
                        letterSpacing: 0.4,
                        fontFamily: font,
                    }}>
                        {el.leftText || ''}
                    </span>
                    <span style={{
                        fontSize: el.fontSize ?? 9,
                        fontWeight: 700,
                        color: p.accentLight,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        fontFamily: font,
                    }}>
                        {el.rightText || ''}
                    </span>
                </div>
            )

        default:
            return null
    }
}
