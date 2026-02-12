import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { bannedContentService } from '../services/database'

export default function BannedContentBanner({ leagueId, accentColor = '#ef4444' }) {
    const [banList, setBanList] = useState(null)
    const [collapsed, setCollapsed] = useState(true)

    useEffect(() => {
        if (!leagueId) return
        bannedContentService.getByLeague(leagueId)
            .then(data => {
                if (data.banList?.parsed_data) {
                    setBanList(data.banList.parsed_data)
                }
            })
            .catch(() => {})
    }, [leagueId])

    if (!banList) return null

    const hasContent = banList.sections?.some(s => s.items?.length > 0)
    if (!hasContent) return null

    return (
        <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: `${accentColor}30`, background: `linear-gradient(135deg, var(--color-secondary), ${accentColor}08)` }}
        >
            {/* Header — always visible */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${accentColor}15` }}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <h3 className="font-heading font-bold text-sm" style={{ color: accentColor }}>
                            {banList.title || 'Banned Content'}
                        </h3>
                        {banList.updated && (
                            <p className="text-xs text-(--color-text-secondary)">
                                Updated {banList.updated}
                            </p>
                        )}
                    </div>
                </div>
                <ChevronDown
                    className={`w-5 h-5 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
                    style={{ color: accentColor }}
                />
            </button>

            {/* Expandable content */}
            {!collapsed && (
                <div className="px-5 pb-5 border-t border-white/5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                        {banList.sections.filter(s => s.items?.length > 0).map(section => (
                            <div key={section.name}>
                                <h4
                                    className="text-xs font-bold uppercase tracking-wider mb-2"
                                    style={{ color: accentColor }}
                                >
                                    {section.name}
                                </h4>
                                <ul className="space-y-1">
                                    {section.items.map((item, idx) => (
                                        <li key={idx} className="text-sm text-(--color-text-secondary) flex items-start gap-1.5">
                                            <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: `${accentColor}60` }} />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
