import { RARITIES } from '../../../data/vault/economy'

const inputClass = 'px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 w-full'

const FRAME_STYLES = ['default', 'gold', 'silver', 'bronze']

export default function TemplateModeControls({ cardType, rarity, baseCard, onUpdate }) {
    const rarityInfo = RARITIES[rarity]
    const availableHolos = rarityInfo?.holoEffects || ['common']

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Template Settings</h3>

            {/* Holo Effect */}
            <div>
                <label className="block text-xs text-gray-400 mb-1">Holo Effect</label>
                <select
                    value={baseCard.holoType || ''}
                    onChange={e => onUpdate({ holoType: e.target.value || null })}
                    className={inputClass}
                >
                    <option value="">None</option>
                    {availableHolos.map(h => (
                        <option key={h} value={h}>{h.charAt(0).toUpperCase() + h.slice(1)}</option>
                    ))}
                </select>
            </div>

            {/* Frame Style */}
            <div>
                <label className="block text-xs text-gray-400 mb-1">Frame Style</label>
                <select
                    value={baseCard.frameStyle}
                    onChange={e => onUpdate({ frameStyle: e.target.value })}
                    className={inputClass}
                >
                    {FRAME_STYLES.map(f => (
                        <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    ))}
                </select>
            </div>

            {/* Custom card fields */}
            {cardType === 'custom' && (
                <>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Custom Name</label>
                        <input
                            type="text"
                            value={baseCard.customName || ''}
                            onChange={e => onUpdate({ customName: e.target.value })}
                            placeholder="Card name..."
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Flavor Text</label>
                        <textarea
                            value={baseCard.flavorText || ''}
                            onChange={e => onUpdate({ flavorText: e.target.value })}
                            placeholder="Add flavor text..."
                            rows={3}
                            className={`${inputClass} resize-none`}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Custom Image URL</label>
                        <input
                            type="text"
                            value={baseCard.customImage || ''}
                            onChange={e => onUpdate({ customImage: e.target.value })}
                            placeholder="https://..."
                            className={inputClass}
                        />
                    </div>
                </>
            )}

            {/* Info box for standard types */}
            {['player', 'god', 'item'].includes(cardType) && (
                <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <p className="text-xs text-gray-400">
                        Definition selector for <span className="text-amber-400 font-medium">{cardType}</span> cards
                    </p>
                </div>
            )}
        </div>
    )
}
