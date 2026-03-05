import { getItemImageUrl } from '../../../data/cardclash/items';

const CATEGORY_COLORS = {
  'Physical Offense': 'border-orange-500/50 bg-orange-950/30',
  'Magical Offense': 'border-purple-500/50 bg-purple-950/30',
  'Physical Defense': 'border-amber-500/50 bg-amber-950/30',
  'Magical Defense': 'border-blue-500/50 bg-blue-950/30',
  'Utility': 'border-gray-400/50 bg-gray-900/30',
  'Relic': 'border-yellow-500/50 bg-yellow-950/30',
  'Consumable': 'border-green-500/50 bg-green-950/30',
};

export default function ItemCard({ item, size = 'normal', onClick, selected }) {
  const colorClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Utility;
  const isSmall = size === 'small';

  return (
    <div
      onClick={onClick}
      className={`${isSmall ? 'w-28' : 'w-40'} rounded-lg border ${colorClass} cursor-pointer transition-all hover:scale-[1.02] overflow-hidden ${
        selected ? 'ring-2 ring-gold' : ''
      }`}
    >
      {/* Header */}
      <div className="px-2 py-1 flex justify-between items-center border-b border-gray-800">
        <span className="text-[9px] uppercase text-gray-400">{item.category}</span>
        <span className="text-[10px] text-mana font-bold">{item.manaCost}m</span>
      </div>

      {/* Image */}
      <div className="flex justify-center py-2 bg-black/30">
        <img
          src={getItemImageUrl(item)}
          alt={item.name}
          className={`${isSmall ? 'w-12 h-12' : 'w-16 h-16'} object-contain`}
          loading="lazy"
        />
      </div>

      {/* Name */}
      <div className="px-2 py-1 border-t border-gray-800">
        <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
      </div>

      {/* Effects */}
      <div className="px-2 py-1 flex flex-wrap gap-1">
        {item.effects?.attack && (
          <span className="text-[9px] bg-orange-900/50 text-orange-300 px-1 rounded">+{item.effects.attack} ATK</span>
        )}
        {item.effects?.defense && (
          <span className="text-[9px] bg-blue-900/50 text-blue-300 px-1 rounded">+{item.effects.defense} DEF</span>
        )}
        {item.effects?.hp && (
          <span className="text-[9px] bg-red-900/50 text-red-300 px-1 rounded">+{item.effects.hp} HP</span>
        )}
        {item.effects?.mana && (
          <span className="text-[9px] bg-cyan-900/50 text-cyan-300 px-1 rounded">+{item.effects.mana} MP</span>
        )}
      </div>

      {/* Passive */}
      {item.passive && (
        <div className="px-2 py-1 border-t border-gray-800">
          <div className="text-[9px] font-bold text-amber-400">{item.passive.name}</div>
          <p className="text-[8px] text-gray-400 line-clamp-2">{item.passive.description}</p>
        </div>
      )}
    </div>
  );
}
