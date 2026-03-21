import { S5_FLAT_CORES, S5_FLAT_PASSION, S5_REVERSE_MULT, S5_FULL_RATIO,
  S5_FLAT_SCALE, S5_REVERSE_FLAT_RATIO,
  S5_ATT_FLAT, S5_ATT_MULT, S5_FULL_ATT_RATIO,
  CONSUMABLE_SLOT_SCALING, CONSUMABLE_SPREADS } from '../../../data/vault/economy'
import passionCoin from '../../../assets/passion/passion.png'
import emberIcon from '../../../assets/ember.png'

export function getCardEffect(card) {
  const type = card.cardType || 'god'
  const r = card.rarity
  const ht = card.holoType

  if (type === 'player') {
    let flatCores = 0, flatPassion = 0, multiplier = 0
    const scaledCores = (S5_FLAT_CORES[r] || 0) * S5_FLAT_SCALE
    const scaledPassion = (S5_FLAT_PASSION[r] || 0) * S5_FLAT_SCALE
    if (ht === 'holo') {
      flatCores = scaledCores
      flatPassion = scaledPassion
    } else if (ht === 'reverse') {
      flatCores = scaledCores * S5_REVERSE_FLAT_RATIO
      flatPassion = scaledPassion * S5_REVERSE_FLAT_RATIO
      multiplier = S5_REVERSE_MULT[r] || 0
    } else if (ht === 'full') {
      flatCores = scaledCores * S5_FULL_RATIO
      flatPassion = scaledPassion * S5_FULL_RATIO
      const baseMult = S5_REVERSE_MULT[r] || 1
      multiplier = 1 + (baseMult - 1) * S5_FULL_RATIO
    }
    if (!flatCores && !multiplier) return null
    return { effectType: 'player', flatCores, flatPassion, multiplier }
  }

  if (type === 'god' || type === 'item') {
    const flatTable = S5_ATT_FLAT[type]
    const multTable = S5_ATT_MULT[type]
    if (!flatTable) return null
    const flatVal = flatTable[r] || 0
    const multVal = multTable?.[r] || 0
    let flatPct = 0, multPct = 0
    if (ht === 'holo') {
      flatPct = Math.round(flatVal * 100)
    } else if (ht === 'reverse') {
      multPct = Math.round(multVal * 100)
    } else if (ht === 'full') {
      flatPct = Math.round(flatVal * S5_FULL_ATT_RATIO * 100)
      multPct = Math.round(multVal * S5_FULL_ATT_RATIO * 100)
    }
    if (!flatPct && !multPct) return null
    return { effectType: 'attachment', flatPct, multPct }
  }

  if (type === 'consumable') {
    const consumableId = card.cardData?.consumableId
    const total = CONSUMABLE_SLOT_SCALING[r] || 0
    const spread = CONSUMABLE_SPREADS[consumableId] || { passion: 0.5, cores: 0.5 }
    const passionPct = Math.round(total * spread.passion * 100)
    const coresPct = Math.round(total * spread.cores * 100)
    if (!passionPct && !coresPct) return null
    return { effectType: 'consumable', passionPct, coresPct }
  }

  return null
}

export default function CardEffectDisplay({ card }) {
  const effect = getCardEffect(card)
  if (!effect) return null

  if (effect.effectType === 'player') {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold cd-num">
        {effect.flatCores > 0 && (
          <span className="flex items-center gap-0.5 text-amber-400">
            <img src={emberIcon} alt="" className="w-2.5 h-2.5" />
            {effect.flatCores < 1 ? effect.flatCores.toFixed(2) : effect.flatCores.toFixed(1)}/d
          </span>
        )}
        {effect.multiplier > 1 && (
          <span className="flex items-center gap-0.5 text-emerald-400">
            {effect.multiplier.toFixed(2)}x
          </span>
        )}
      </div>
    )
  }

  if (effect.effectType === 'attachment') {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold cd-num">
        {effect.flatPct > 0 && (
          <span className="text-amber-400">+{effect.flatPct}% flat</span>
        )}
        {effect.multPct > 0 && (
          <span className="text-[var(--cd-cyan)]">+{effect.multPct}% mult</span>
        )}
      </div>
    )
  }

  if (effect.effectType === 'consumable') {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold cd-num">
        {effect.passionPct > 0 && (
          <span className="flex items-center gap-0.5 text-amber-400">
            <img src={passionCoin} alt="" className="w-2.5 h-2.5" />
            +{effect.passionPct}%
          </span>
        )}
        {effect.coresPct > 0 && (
          <span className="flex items-center gap-0.5 text-[var(--cd-cyan)]">
            <img src={emberIcon} alt="" className="w-2.5 h-2.5" />
            +{effect.coresPct}%
          </span>
        )}
      </div>
    )
  }

  return null
}
