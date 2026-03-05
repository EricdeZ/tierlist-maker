const SECTIONS = [
  {
    title: 'Core Systems',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    items: [
      { label: 'Collection page with filters, sort, detail panel', done: true },
      { label: 'Pack shop — 4 tiers with guaranteed rarity slots', done: true },
      { label: 'Starting Five lineup — set one card per role', done: true },
      { label: 'Card Clash battles — PvE with AI opponent', done: true },
      { label: 'Passive income from Starting Five', done: true },
      { label: 'Disenchant cards for Embers', done: true },
      { label: 'Deck builder — save/load named decks', done: true },
      { label: 'Leaderboard — ELO rankings', done: true },
      { label: 'Test mode toggle (no Passion spent)', done: true },
    ],
  },
  {
    title: 'Backend & Persistence',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    items: [
      { label: 'Database tables (cc_cards, cc_lineups, cc_stats, cc_decks)', done: true },
      { label: 'API endpoint with auth (load, open-pack, set-lineup, battle, etc.)', done: true },
      { label: 'Real Passion integration via grantPassion()', done: true },
      { label: 'Feature flag + admin-only access gate', done: true },
      { label: 'Server-side pack opening with rarity rolling', done: true },
      { label: 'ELO calculation (K=32) for ranked mode', done: true },
    ],
  },
  {
    title: 'Card Visuals',
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    items: [
      { label: 'Integrate TradingCardHolo holographic effects into GodCard' },
      { label: 'Rarity-specific holo patterns (15 effects available)' },
      { label: 'God portrait images from CDN' },
      { label: 'Card flip animation on reveal' },
      { label: 'Rarity glow/shimmer on hover' },
      { label: 'Serial number display with rarity badge' },
    ],
  },
  {
    title: 'Game Mechanics (Game Designer)',
    color: 'text-green-400',
    border: 'border-green-500/30',
    items: [
      { label: 'Battle resolution formula — how power/stats/abilities interact' },
      { label: 'Card abilities — unique effects per god (stun, buff, heal, etc.)' },
      { label: 'Synergy system — team composition bonuses' },
      { label: 'Card leveling — XP thresholds, stat growth curves' },
      { label: 'Crafting with Embers — forge specific cards or reroll' },
      { label: 'Item system — equippable items that modify card stats' },
      { label: 'Status effects and counter-play between abilities' },
      { label: 'Wager mode stakes + pot splitting' },
      { label: 'Tournament format and bracket system' },
    ],
  },
  {
    title: 'Economy & Balance',
    color: 'text-cyan-400',
    border: 'border-cyan-500/30',
    items: [
      { label: 'Pack pricing — balance cost vs card quality' },
      { label: 'Passion income rates — Starting Five daily payout' },
      { label: 'Battle rewards by mode (quick/ranked/wager)' },
      { label: 'Ember values per rarity for disenchant' },
      { label: 'Marketplace — player-to-player card trading' },
      { label: 'Marketplace fee structure (currently 5%)' },
      { label: 'Ranked season rewards by tier' },
      { label: 'Daily/weekly challenges for bonus Passion' },
    ],
  },
  {
    title: 'Full Game Mode (3-Lane Strategy)',
    color: 'text-red-400',
    border: 'border-red-500/30',
    items: [
      { label: 'Lane-based board with Solo/Mid/ADC lanes' },
      { label: 'Turn-based card placement and combat' },
      { label: 'Minion waves and structure health' },
      { label: 'Gold/XP economy within a match' },
      { label: 'Item shop during match' },
      { label: 'Win condition — destroy enemy Titan' },
    ],
  },
  {
    title: 'Social & Multiplayer',
    color: 'text-orange-400',
    border: 'border-orange-500/30',
    items: [
      { label: 'PvP matchmaking — match against real players' },
      { label: 'Trade offers — send/receive card trades' },
      { label: 'Match history log' },
      { label: 'Profile integration — show CC rank, collection count, win rate' },
      { label: 'Friends list challenge — direct PvP invite' },
    ],
  },
  {
    title: 'Polish & UX',
    color: 'text-pink-400',
    border: 'border-pink-500/30',
    items: [
      { label: 'Card Clash-specific navbar (not global smitecomp nav)' },
      { label: 'Mobile-responsive layouts for all tabs' },
      { label: 'Pack opening animation — card-by-card reveal with effects' },
      { label: 'Sound effects for pack open, battle, rare card pull' },
      { label: 'Tutorial / onboarding flow for new players' },
      { label: 'Empty state illustrations for no cards, no matches, etc.' },
      { label: 'Keyboard shortcuts (arrow keys to browse collection)' },
    ],
  },
]

export default function CCTodo() {
  const totalItems = SECTIONS.reduce((sum, s) => sum + s.items.length, 0)
  const doneItems = SECTIONS.reduce((sum, s) => sum + s.items.filter(i => i.done).length, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Card Clash — Roadmap</h1>
        <p className="text-sm text-gray-400 mt-1">
          {doneItems}/{totalItems} tasks complete ({Math.round(doneItems / totalItems * 100)}%)
        </p>
        <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
            style={{ width: `${(doneItems / totalItems) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {SECTIONS.map(section => {
          const sectionDone = section.items.filter(i => i.done).length
          return (
            <div key={section.title} className={`border ${section.border} rounded-xl overflow-hidden`}>
              <div className="bg-gray-900/50 px-4 py-3 flex justify-between items-center">
                <h2 className={`font-bold ${section.color}`}>{section.title}</h2>
                <span className="text-xs text-gray-500">{sectionDone}/{section.items.length}</span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {section.items.map((item, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs shrink-0 ${
                      item.done
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-800 text-gray-600'
                    }`}>
                      {item.done ? '✓' : '○'}
                    </span>
                    <span className={`text-sm ${item.done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
