export const ROLES = ['adc', 'solo', 'jungle', 'mid', 'support']

export const ROLE_PALETTES = {
    adc:     { accent: '#c4884a', accentLight: '#e0a866', accentDark: '#8a5c2a', bodyBg: '#1e1810', bodySurface: '#2a2018', bodyBorder: '#4a3828', textDim: '#9a8a70' },
    solo:    { accent: '#4a8ec4', accentLight: '#66b0e0', accentDark: '#2a5c8a', bodyBg: '#10161e', bodySurface: '#182230', bodyBorder: '#283a50', textDim: '#708a9a' },
    jungle:  { accent: '#4ab868', accentLight: '#66d884', accentDark: '#2a7a3e', bodyBg: '#101e14', bodySurface: '#18301e', bodyBorder: '#285038', textDim: '#709a7a' },
    mid:     { accent: '#9a5cc4', accentLight: '#b878e0', accentDark: '#6a3a8a', bodyBg: '#1a101e', bodySurface: '#261830', bodyBorder: '#402850', textDim: '#8a709a' },
    support: { accent: '#4aaab8', accentLight: '#66c8d4', accentDark: '#2a7a84', bodyBg: '#101c1e', bodySurface: '#182a30', bodyBorder: '#284a50', textDim: '#70949a' },
}

const PREBUILT_TYPES = new Set(['name-banner', 'stats-block', 'subtitle', 'footer'])

export function isPrebuiltType(type) {
    return PREBUILT_TYPES.has(type)
}

export function renderPrebuiltContent(el) {
    const p = ROLE_PALETTES[el.role] || ROLE_PALETTES.adc
    const font = el.font || "'Segoe UI', system-ui, sans-serif"

    switch (el.type) {
        case 'name-banner':
            return (
                <div className="pointer-events-none" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    background: p.bodyBg,
                    gap: 6,
                }}>
                    <span style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: el.fontSize ?? 16,
                        fontWeight: 800,
                        color: '#fff',
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
            const hasRecord = record.winRate || record.record || record.games
            return (
                <div className="pointer-events-none" style={{
                    background: p.bodySurface,
                    border: `1px solid ${p.bodyBorder}`,
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
                                color: '#fff',
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
                                    <div style={{ fontSize: (el.fontSize ?? 10) + 1, fontWeight: 800, color: '#fff' }}>{record.winRate}</div>
                                    <div style={{ fontSize: 7, color: p.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>WR</div>
                                </div>
                            )}
                            {record.record && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: (el.fontSize ?? 10) + 1, fontWeight: 800, color: '#fff' }}>{record.record}</div>
                                    <div style={{ fontSize: 7, color: p.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Record</div>
                                </div>
                            )}
                            {record.games && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: (el.fontSize ?? 10) + 1, fontWeight: 800, color: '#fff' }}>{record.games}</div>
                                    <div style={{ fontSize: 7, color: p.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Games</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        }

        case 'subtitle':
            return (
                <div className="pointer-events-none" style={{
                    padding: '2px 10px',
                    textAlign: 'center',
                    lineHeight: 1,
                    background: el.showBg ? p.bodyBg : 'transparent',
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
                    padding: '3px 10px 5px',
                    background: el.showBg ? p.bodyBg : 'transparent',
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
