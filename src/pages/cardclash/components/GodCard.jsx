import { RARITIES } from '../../../data/cardclash/economy';
import { CLASS_DAMAGE } from '../../../data/cardclash/gods';

const ROLE_COLORS = {
  solo: 'from-blue-500/20 to-blue-900/40',
  jungle: 'from-green-500/20 to-green-900/40',
  mid: 'from-purple-500/20 to-purple-900/40',
  support: 'from-cyan-500/20 to-cyan-900/40',
  adc: 'from-red-500/20 to-red-900/40',
};

const ROLE_BORDERS = {
  solo: 'border-blue-500/40',
  jungle: 'border-green-500/40',
  mid: 'border-purple-500/40',
  support: 'border-cyan-500/40',
  adc: 'border-red-500/40',
};

const CLASS_ICONS = {
  Guardian: '🛡',
  Warrior: '⚔',
  Assassin: '🗡',
  Mage: '✨',
  Hunter: '🏹',
};

export default function GodCard({ card, size = 'normal', onClick, selected, showStats = true }) {
  const rarity = RARITIES[card.rarity] || RARITIES.common;
  const role = card.role || 'mid';
  const isSmall = size === 'small';
  const isTiny = size === 'tiny';

  if (isTiny) {
    return (
      <div
        onClick={onClick}
        className={`w-16 h-20 rounded border-2 cursor-pointer transition-all hover:scale-105 flex flex-col items-center justify-center gap-0.5 ${
          selected ? 'ring-2 ring-gold scale-105' : ''
        } ${ROLE_BORDERS[role]} bg-gradient-to-b ${ROLE_COLORS[role]}`}
        style={{ borderColor: rarity.color }}
      >
        <img src={card.imageUrl} alt={card.godName || card.name} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
        <div className="text-[8px] text-white truncate w-full text-center px-0.5">{card.godName || card.name}</div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${isSmall ? 'w-36' : 'w-52'} rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02] overflow-hidden ${
        selected ? 'ring-2 ring-gold scale-[1.02]' : ''
      } ${ROLE_BORDERS[role]}`}
      style={{ borderColor: rarity.color, boxShadow: `0 0 12px ${rarity.color}30` }}
    >
      {/* Card header */}
      <div className={`bg-gradient-to-r ${ROLE_COLORS[role]} px-2 py-1.5 flex justify-between items-center`}>
        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-300">{role}</span>
        <span className="text-[10px] font-bold" style={{ color: rarity.color }}>{rarity.name}</span>
      </div>

      {/* Image */}
      <div className="relative bg-gray-900">
        <img
          src={card.imageUrl}
          alt={card.godName || card.name}
          className={`w-full ${isSmall ? 'h-28' : 'h-40'} object-cover object-top`}
          loading="lazy"
        />
        {/* Power badge */}
        <div className="absolute top-1 right-1 bg-black/70 rounded px-1.5 py-0.5 text-xs font-bold" style={{ color: rarity.color }}>
          {card.power}
        </div>
        {/* Class icon */}
        <div className="absolute top-1 left-1 bg-black/70 rounded px-1 py-0.5 text-xs">
          {CLASS_ICONS[card.godClass || card.class]} {card.godClass || card.class}
        </div>
        {/* Level */}
        {card.level > 1 && (
          <div className="absolute bottom-1 left-1 flex gap-0.5">
            {Array.from({ length: card.level }, (_, i) => (
              <span key={i} className="text-yellow-400 text-[10px]">★</span>
            ))}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="bg-gray-900 px-2 py-1.5 border-y border-gray-800">
        <h3 className={`${isSmall ? 'text-xs' : 'text-sm'} font-bold text-white truncate`}>{card.godName || card.name}</h3>
        <div className="text-[10px] text-gray-400">
          {CLASS_DAMAGE[card.godClass || card.class]} {card.godClass || card.class}
        </div>
      </div>

      {/* Stats */}
      {showStats && !isSmall && (
        <div className="bg-gray-900/90 px-2 py-1.5 grid grid-cols-3 gap-1 text-center">
          <StatBadge label="HP" value={card.stats?.hp || card.hp || '?'} color="text-red-400" />
          <StatBadge label="ATK" value={card.stats?.attack || card.attack || '?'} color="text-orange-400" />
          <StatBadge label="DEF" value={card.stats?.defense || card.defense || '?'} color="text-blue-400" />
        </div>
      )}

      {/* Ability */}
      {showStats && !isSmall && card.ability && (
        <div className="bg-gray-950 px-2 py-1.5 border-t border-gray-800">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-amber-400">{card.ability.name}</span>
            <span className="text-[9px] text-mana">{card.ability.manaCost} mana</span>
          </div>
          <p className="text-[9px] text-gray-400 mt-0.5 line-clamp-2">{card.ability.description}</p>
        </div>
      )}

      {/* Mana cost footer */}
      <div className={`bg-gradient-to-r ${ROLE_COLORS[role]} px-2 py-1 flex justify-between`}>
        <span className="text-[10px] text-gray-400">#{card.serialNumber || '???'}</span>
        <span className="text-[10px] text-mana font-bold">{card.manaCost || '?'} mana</span>
      </div>
    </div>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div>
      <div className={`text-xs font-bold ${color}`}>{value}</div>
      <div className="text-[8px] text-gray-500">{label}</div>
    </div>
  );
}
