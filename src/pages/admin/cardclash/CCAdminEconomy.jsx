import { RARITIES, PACKS, GAME_MODES, RANKED_TIERS, CARD_LEVELS, MARKETPLACE, TRADING, SYNERGIES, XP_SOURCES, INCOME, UPGRADE } from '../../../data/cardclash/economy'

export default function CCAdminEconomy() {
  return (
    <div className="space-y-6">
      {/* Rarity config */}
      <Section title="Rarity Configuration">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                <th className="p-3">Rarity</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Drop Rate</th>
                <th className="p-3">Ember Value</th>
                <th className="p-3">Craft Cost</th>
                <th className="p-3">Targeted Craft</th>
                <th className="p-3">Passive Income</th>
                <th className="p-3">Holo Effects</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(RARITIES).map(([key, r]) => (
                <tr key={key} className="border-b border-white/5">
                  <td className="p-3">
                    <span className="font-bold capitalize" style={{ color: r.color }}>{r.name}</span>
                  </td>
                  <td className="p-3 font-mono">{r.tier}</td>
                  <td className="p-3 font-mono">{(r.dropRate * 100).toFixed(1)}%</td>
                  <td className="p-3 font-mono">{r.emberValue}</td>
                  <td className="p-3 font-mono">{r.craftCost}</td>
                  <td className="p-3 font-mono">{r.targetedCraftCost}</td>
                  <td className="p-3 font-mono">{r.passiveIncome}/day</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {r.holoEffects.map(h => (
                        <span key={h} className="px-1.5 py-0.5 rounded bg-white/5 text-xs">{h}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Pack types */}
      <Section title="Pack Types">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(PACKS).map(([key, pack]) => (
            <div key={key} className="bg-black/20 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-amber-400">{pack.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-[var(--color-text-secondary)]">Cost:</span> <strong>{pack.cost} Passion</strong></div>
                <div><span className="text-[var(--color-text-secondary)]">Cards:</span> <strong>{pack.cards}</strong></div>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                <strong>Guarantees:</strong>
                {pack.guarantees.map((g, i) => (
                  <span key={i} className="ml-1">{g.count}x {g.minRarity}+</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Game modes */}
      <Section title="Game Modes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                <th className="p-3">Mode</th>
                <th className="p-3">Entry Fee</th>
                <th className="p-3">Win Reward</th>
                <th className="p-3">Loss Penalty</th>
                <th className="p-3">Matchmaking</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(GAME_MODES).map(([key, mode]) => (
                <tr key={key} className="border-b border-white/5">
                  <td className="p-3 font-bold">{mode.name}</td>
                  <td className="p-3 font-mono">{mode.entryFee} embers</td>
                  <td className="p-3 font-mono text-green-400">{mode.winReward} embers</td>
                  <td className="p-3 font-mono text-red-400">{mode.losePenalty} embers</td>
                  <td className="p-3 text-xs">{mode.matchmake}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Ranked tiers */}
      <Section title="Ranked Tiers">
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
          {RANKED_TIERS.map(tier => (
            <div key={tier.name} className="bg-black/20 rounded-xl p-3 text-center">
              <div className="font-bold text-amber-400">{tier.name}</div>
              <div className="text-xs text-[var(--color-text-secondary)]">{tier.minElo} - {tier.maxElo}</div>
              <div className="text-xs mt-1">{tier.weeklyReward} Passion/wk</div>
              {tier.rewardPack && <div className="text-[10px] text-amber-400">+ {tier.rewardPack} pack</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Card levels */}
      <Section title="Card Leveling">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                <th className="p-3">Level</th>
                <th className="p-3">XP Required</th>
                <th className="p-3">Power Bonus</th>
              </tr>
            </thead>
            <tbody>
              {CARD_LEVELS.map(lvl => (
                <tr key={lvl.level} className="border-b border-white/5">
                  <td className="p-3 font-bold">Level {lvl.level}</td>
                  <td className="p-3 font-mono">{lvl.xpRequired}</td>
                  <td className="p-3 font-mono text-green-400">+{lvl.powerBonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* XP Sources */}
      <Section title="XP Sources">
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(XP_SOURCES).map(([key, val]) => (
            <div key={key} className="bg-black/20 rounded-lg p-3">
              <div className="text-xs text-[var(--color-text-secondary)] capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
              <div className="text-lg font-bold text-amber-400">+{val} XP</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Synergies */}
      <Section title="Starting Five Synergies">
        <div className="space-y-2">
          {Object.entries(SYNERGIES).map(([key, syn]) => (
            <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
              <div className="flex-1">
                <div className="text-sm font-bold capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">{syn.description}</div>
              </div>
              <div className="text-sm font-bold text-green-400">
                +{(syn.bonus * 100).toFixed(0)}%
                {syn.fullSquad && <span className="text-amber-400 ml-1">(+{(syn.fullSquad * 100).toFixed(0)}% full)</span>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Marketplace */}
        <Section title="Marketplace">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Listing Fee</span><span>{MARKETPLACE.listingFeePercent}%</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Max Active Listings</span><span>{MARKETPLACE.maxActiveListings}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Listing Duration</span><span>{MARKETPLACE.listingDurationDays} days</span></div>
          </div>
        </Section>

        {/* Trading */}
        <Section title="Trading">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Max Cards/Side</span><span>{TRADING.maxCardsPerSide}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Max Passion/Side</span><span>{TRADING.maxPassionPerSide}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Offer Expiry</span><span>{TRADING.expiryHours}h</span></div>
          </div>
        </Section>

        {/* Upgrades */}
        <Section title="Upgrades">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Copies Required</span><span>{UPGRADE.copiesRequired}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Power Bonus</span><span>+{UPGRADE.powerBonusOnUpgrade}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-text-secondary)]">Income Max Accrual</span><span>{INCOME.maxAccrualDays} days</span></div>
          </div>
        </Section>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-sm text-amber-400">
          Economy values are currently defined in <code className="bg-black/30 px-1 rounded">src/data/cardclash/economy.js</code> and <code className="bg-black/30 px-1 rounded">functions/lib/cardclash.js</code>.
          To modify these values, edit those files and redeploy. A future update will move these to a database-backed config.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-[var(--color-secondary)] rounded-xl border border-white/10 p-5">
      <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  )
}
