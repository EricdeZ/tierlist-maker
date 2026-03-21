import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { vaultService } from '../../../services/database'
import { Trophy, Package } from 'lucide-react'

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
]

export default function PackLeaderboard() {
  const { user } = useAuth()
  const [period, setPeriod] = useState('daily')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const fetched = useRef(new Set())

  useEffect(() => {
    if (fetched.current.has(period)) return
    fetched.current.add(period)
    setLoading(true)
    vaultService.loadPackLeaderboard(period)
      .then(res => setData(prev => ({ ...prev, [period]: res })))
      .catch(() => fetched.current.delete(period))
      .finally(() => setLoading(false))
  }, [period])

  const current = data[period]

  return (
    <div className="mt-10 border-t border-white/[0.04] pt-8">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={16} className="text-amber-400/70" />
        <span className="text-[10px] text-white/30 uppercase tracking-widest cd-head">
          Pack Opening Leaderboard
        </span>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 mb-4">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] cd-head tracking-wider font-bold transition-all ${
              period === p.key
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-white/[0.03] text-white/30 border border-transparent hover:text-white/50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="cd-spinner w-6 h-6" />
        </div>
      ) : !current?.leaderboard?.length ? (
        <div className="text-center py-12">
          <Package className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-white/25 cd-head tracking-wider text-xs">No packs opened yet this period</p>
        </div>
      ) : (
        <div className="space-y-[2px]">
          {current.leaderboard.map(entry => (
            <LeaderboardRow key={entry.userId} entry={entry} isMe={entry.userId === user?.id} />
          ))}
          {current.myEntry && (
            <>
              <div className="text-center text-white/15 text-xs py-1">...</div>
              <LeaderboardRow entry={current.myEntry} isMe />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function LeaderboardRow({ entry, isMe }) {
  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg ${
        isMe ? 'bg-amber-500/[0.06] border border-amber-500/20' : 'bg-white/[0.02]'
      }`}
    >
      <div className={`w-8 sm:w-9 text-center cd-num text-sm sm:text-base font-bold ${
        entry.position === 1 ? 'text-yellow-400' :
        entry.position === 2 ? 'text-gray-300' :
        entry.position === 3 ? 'text-amber-600' : 'text-white/25'
      }`}>
        #{entry.position}
      </div>
      {entry.avatar && entry.discordId ? (
        <img
          src={`https://cdn.discordapp.com/avatars/${entry.discordId}/${entry.avatar}.png?size=32`}
          alt=""
          className="w-8 h-8 rounded-full flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white/30">
          {(entry.username || '?')[0]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold cd-head truncate text-white/80">
          {entry.username || 'Unknown'}
          {isMe && <span className="text-amber-400 text-xs ml-1">(you)</span>}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Package size={14} className="text-amber-400/60" />
          <span className="text-base font-bold cd-num text-white/70">{entry.packsOpened}</span>
        </div>
        <div className="text-[10px] text-white/25 cd-num">
          pack{entry.packsOpened !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
