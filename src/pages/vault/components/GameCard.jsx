import './GameCard.css'
import { RARITIES } from '../../../data/vault/economy'
import { CLASS_DAMAGE, CLASS_ROLE } from '../../../data/vault/gods'
import PassiveIndicator from './PassiveIndicator'

const ABILITY_ICONS = {
  damage: 'Dmg', aoe_damage: 'AOE', heal: 'Heal', buff: 'Buff',
  debuff: 'Debf', cc: 'CC', execute: 'Exec', shield: 'Shld',
  summon: 'Smn', global: 'Glbl', stealth: 'Stlh', mobility: 'Move',
  rotate: 'Rot', gank: 'Gank', split: 'Split', vision: 'Vis',
  zone: 'Zone', objective: 'Obj', wave: 'Wave', invade: 'Inv',
}

// Convert px offsets (authored at 240px card = 232px content = 100cqi) to cqi so they scale
function imgTransformStyle(meta) {
  if (!meta) return undefined
  if (!meta.image_offset_x && !meta.image_offset_y && !meta.image_zoom) return undefined
  const ox = (meta.image_offset_x || 0) * (100 / 232)
  const oy = (meta.image_offset_y || 0) * (100 / 232)
  return { transform: `translate(${ox}cqi, ${oy}cqi) scale(${meta.image_zoom || 1})` }
}

function itemCatSlug(category) {
  if (!category) return 'utility'
  return category.toLowerCase().replace(/\s+/g, '-')
}

export default function GameCard({ type = 'god', rarity = 'common', data, compact, size, onClick, passiveName }) {
  const rarityInfo = RARITIES[rarity] || RARITIES.common
  const role = type === 'god' ? (data.role || CLASS_ROLE[data.class] || 'mid') : null
  const scale = size ? parseFloat(size) / 240 : NaN
  const style = { '--card-scale': Number.isFinite(scale) ? scale : 1 }
  if (size) style.width = size
  if (onClick) style.cursor = 'pointer'

  return (
    <div
      className={`game-card ${compact ? 'compact' : ''}`}
      data-rarity={rarity}
      data-role={role}
      data-type={type !== 'god' ? type : undefined}
      data-item-cat={type === 'item' ? itemCatSlug(data.category) : undefined}
      onClick={onClick}
      style={Object.keys(style).length ? style : undefined}
    >
      <div className="game-card__border">
        <div className="game-card__body">
          {type === 'god' && <GodCardContent data={data} rarity={rarity} rarityInfo={rarityInfo} />}
          {type === 'item' && <ItemCardContent data={data} rarity={rarity} rarityInfo={rarityInfo} />}
          {type === 'minion' && <MinionCardContent data={data} rarity={rarity} rarityInfo={rarityInfo} />}
          {type === 'buff' && <BuffCardContent data={data} rarity={rarity} rarityInfo={rarityInfo} />}
          {type === 'consumable' && <ConsumableCardContent data={data} rarity={rarity} rarityInfo={rarityInfo} />}

          {data.signatureUrl && (
            <div className="game-card__signature">
              <img src={data.signatureUrl} alt="Signature" loading="lazy" />
            </div>
          )}
        </div>
      </div>
      {(passiveName || data.passiveName) && <PassiveIndicator passiveName={passiveName || data.passiveName} size={size ? parseFloat(size) : 240} />}
    </div>
  )
}

function GodCardContent({ data, rarity, rarityInfo }) {
  const role = data.role || CLASS_ROLE[data.class] || 'mid'
  const dmgType = CLASS_DAMAGE[data.class] || 'Physical'
  const imageUrl = data.imageUrl || getGodImageUrl(data)
  const imgStyle = imgTransformStyle(data.metadata)

  return (
    <>
      <div className="game-card__top">
        <span className="game-card__top-name">{data.name}</span>
        <span className="game-card__type-label">{role}</span>
      </div>

      <div className="game-card__image-wrap">
        <div className="game-card__image">
          <img src={imageUrl} alt={data.name} loading="lazy" style={imgStyle} />
        </div>
      </div>

      <div className="game-card__subtitle">
        <span>{data.class} &middot; {dmgType}</span>
      </div>

      {data.ability && (
        <div className="game-card__ability">
          <div className="game-card__ability-name">
            {ABILITY_ICONS[data.ability.type] && (
              <span style={{ opacity: 0.5, marginRight: '1.72cqi', fontSize: '3.45cqi' }}>[{ABILITY_ICONS[data.ability.type]}]</span>
            )}
            {data.ability.name}
          </div>
          <div className="game-card__ability-desc">{data.ability.description}</div>
          <div className="game-card__ability-cost">
            <span className="mana-cost">{data.ability.manaCost} mana</span>
            <span className="cooldown">{data.ability.cooldown}t CD</span>
          </div>
        </div>
      )}

      <div className="game-card__footer">
        <span className="game-card__serial">#{data.serialNumber || data.id || '???'}</span>
        <span className="game-card__rarity-label">{rarityInfo.name}</span>
      </div>
    </>
  )
}

function ItemCardContent({ data, rarity, rarityInfo }) {
  const imageUrl = data.imageUrl || getItemImageUrl(data)
  const imgStyle = imgTransformStyle(data.metadata)

  return (
    <>
      <div className="game-card__top">
        <span className="game-card__top-name">{data.name}</span>
        <div className="game-card__top-stat">
          <span className="game-card__power-label">COST</span>
          <span className="game-card__power-value"> {data.manaCost}</span>
        </div>
      </div>

      <div className="game-card__image-wrap">
        <div className="game-card__image">
          {imageUrl ? (
            <img src={imageUrl} alt={data.name} loading="lazy" style={imgStyle} />
          ) : (
            <div className="game-card__image-placeholder">I</div>
          )}
        </div>
      </div>

      {data.effects && Object.keys(data.effects).length > 0 && (
        <div className="game-card__subtitle">
          <span>
            {Object.entries(data.effects).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' · ')}
          </span>
        </div>
      )}

      {data.passive && (
        <div className="game-card__ability">
          <div className="game-card__ability-desc"><span className="game-card__ability-name">{data.passive.name}</span> {data.passive.description}</div>
        </div>
      )}

      <div className="game-card__footer">
        <span className="game-card__serial">#{data.id || '???'}</span>
        <span className="game-card__rarity-label">{rarityInfo.name}</span>
      </div>
    </>
  )
}

function MinionCardContent({ data, rarity, rarityInfo }) {
  const imageUrl = data.imageUrl
  const imgStyle = imgTransformStyle(data.metadata)
  return (
    <>
      <div className="game-card__top">
        <span className="game-card__top-name">{data.name}</span>
        <div className="game-card__top-stat">
          <span className="game-card__power-label">HP</span>
          <span className="game-card__power-value"> {data.hp}</span>
        </div>
      </div>

      <div className="game-card__image-wrap">
        <div className="game-card__image">
          {imageUrl ? (
            <img src={imageUrl} alt={data.name} loading="lazy" style={imgStyle} />
          ) : (
            <div className="game-card__image-placeholder">M</div>
          )}
        </div>
      </div>

      <div className="game-card__subtitle">
        <span>ATK {data.attack} &middot; DEF {data.defense} &middot; Cost {data.manaCost}</span>
      </div>

      <div className="game-card__ability">
        <div className="game-card__ability-desc">{data.description}</div>
      </div>

      <div className="game-card__footer">
        <span className="game-card__serial">{data.isAutoSpawn ? 'Auto-spawn' : 'Summon'}</span>
        <span className="game-card__rarity-label">{rarityInfo.name}</span>
      </div>
    </>
  )
}

function BuffCardContent({ data, rarity, rarityInfo }) {
  const imageUrl = data.imageUrl
  const imgStyle = imgTransformStyle(data.metadata)
  return (
    <>
      <div className="game-card__top">
        <span className="game-card__top-name">{data.name}</span>
        <div className="game-card__top-stat">
          <span className="game-card__power-label">DUR</span>
          <span className="game-card__power-value"> {data.duration}t</span>
        </div>
      </div>

      <div className="game-card__image-wrap">
        <div className="game-card__image">
          {imageUrl ? (
            <img src={imageUrl} alt={data.name} loading="lazy" style={imgStyle} />
          ) : (
            <div className="game-card__image-placeholder" style={{ color: data.color }}>B</div>
          )}
        </div>
      </div>

      <div className="game-card__ability">
        <div className="game-card__ability-desc">{data.description}</div>
      </div>

      <div className="game-card__footer">
        <span className="game-card__serial">Free</span>
        <span className="game-card__rarity-label">{rarityInfo.name}</span>
      </div>
    </>
  )
}

function ConsumableCardContent({ data, rarity, rarityInfo }) {
  const imageUrl = data.imageUrl
  const imgStyle = imgTransformStyle(data.metadata)
  return (
    <>
      <div className="game-card__top">
        <span className="game-card__top-name">{data.name}</span>
        <div className="game-card__top-stat">
          <span className="game-card__power-label">COST</span>
          <span className="game-card__power-value"> {data.manaCost}</span>
        </div>
      </div>

      <div className="game-card__image-wrap">
        <div className="game-card__image">
          {imageUrl ? (
            <img src={imageUrl} alt={data.name} loading="lazy" style={imgStyle} />
          ) : (
            <div className="game-card__image-placeholder" style={{ color: data.color }}>C</div>
          )}
        </div>
      </div>

      <div className="game-card__ability">
        <div className="game-card__ability-desc">{data.description}</div>
      </div>

      <div className="game-card__footer">
        <span className="game-card__serial">Single use</span>
        <span className="game-card__rarity-label">{rarityInfo.name}</span>
      </div>
    </>
  )
}

// Helpers
function getGodImageUrl(god) {
  if (!god.imageKey) return ''
  return `https://cdn.smitesource.com/cdn-cgi/image/width=256,format=auto,quality=75/Gods/${god.imageKey}/Default/t_GodCard_${god.imageKey}.png`
}

function getItemImageUrl(item) {
  if (!item.imageKey) return ''
  return `https://cdn.smitesource.com/cdn-cgi/image/width=128,format=auto,quality=75/${item.imageKey}.png`
}
