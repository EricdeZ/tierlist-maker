import { TABS } from './forgeConstants'

export default function ForgeTabBar({ activeTab, onNavigateTab }) {
    return (
        <div className="flex gap-0 mb-4">
            {TABS.filter(t => t.key !== 'wiki').map(tab => {
                const Icon = tab.icon
                return (
                    <button
                        key={tab.key}
                        onClick={() => onNavigateTab(tab.key)}
                        className={`flex-1 sm:flex-none px-2 sm:px-6 py-2.5 forge-head text-xs sm:text-lg font-semibold tracking-wider relative transition-all flex items-center justify-center sm:justify-start gap-1.5 ${
                            activeTab === tab.key
                                ? 'text-[var(--forge-flame-bright)] forge-tab-active'
                                : 'text-[var(--forge-text-dim)] hover:text-[var(--forge-text-mid)] hover:bg-[var(--forge-flame)]/3'
                        }`}
                    >
                        <Icon size={16} className="sm:hidden flex-shrink-0" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.key === 'market' ? 'Forge' : tab.key === 'portfolio' ? 'Sparks' : tab.key === 'leaderboard' ? 'Flame' : 'Contracts'}</span>
                        {activeTab === tab.key && (
                            <span
                                className="absolute bottom-0 left-2 right-2 sm:left-3 sm:right-3 h-[2px] forge-tab-underline"
                                style={{ background: 'var(--forge-flame)', boxShadow: '0 0 10px rgba(232,101,32,0.4)' }}
                            />
                        )}
                    </button>
                )
            })}
            {/* Guide tab -- always visible on desktop, hidden on mobile (shown next to status instead) */}
            {(() => {
                const wikiTab = TABS.find(t => t.key === 'wiki')
                const Icon = wikiTab.icon
                return (
                    <button
                        onClick={() => onNavigateTab('wiki')}
                        className={`hidden sm:flex sm:flex-none px-6 py-2.5 forge-head text-lg font-semibold tracking-wider relative transition-all items-center justify-start gap-1.5 ${
                            activeTab === 'wiki'
                                ? 'text-[var(--forge-flame-bright)] forge-tab-active'
                                : 'text-[var(--forge-text-dim)] hover:text-[var(--forge-text-mid)] hover:bg-[var(--forge-flame)]/3'
                        }`}
                    >
                        <span>{wikiTab.label}</span>
                        {activeTab === 'wiki' && (
                            <span
                                className="absolute bottom-0 left-3 right-3 h-[2px] forge-tab-underline"
                                style={{ background: 'var(--forge-flame)', boxShadow: '0 0 10px rgba(232,101,32,0.4)' }}
                            />
                        )}
                    </button>
                )
            })()}
        </div>
    )
}
