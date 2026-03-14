import { useState, useEffect, useCallback } from 'react'
import { vaultAdminService } from '../../../services/database'

export default function CCAdminUsers() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await vaultAdminService.listUsers({ search: search || undefined, limit: 50 })
      setUsers(data.users || [])
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const toggleBan = async (userId, isBanned) => {
    try {
      if (isBanned) {
        await vaultAdminService.unbanUser(userId)
      } else {
        await vaultAdminService.banUser(userId)
      }
      fetchUsers()
    } catch (err) {
      console.error('Failed to toggle ban:', err)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--cd-cyan)]/50"
      />

      {loading ? (
        <div className="flex justify-center py-8"><div className="cd-spinner w-6 h-6" /></div>
      ) : users.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No users found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                <th className="p-3">User</th>
                <th className="p-3">ELO</th>
                <th className="p-3">W/L</th>
                <th className="p-3">Cards</th>
                <th className="p-3">Packs</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-b border-white/5">
                  <td className="p-3 font-medium">{u.discord_username}</td>
                  <td className="p-3 font-mono">{u.elo}</td>
                  <td className="p-3 font-mono">{u.wins}/{u.losses}</td>
                  <td className="p-3 font-mono">{u.card_count}</td>
                  <td className="p-3 font-mono">{u.packs_opened}</td>
                  <td className="p-3">
                    {u.banned_at ? (
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold">Banned</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold">Active</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleBan(u.user_id, !!u.banned_at)}
                      className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                        u.banned_at
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      }`}
                    >
                      {u.banned_at ? 'Unban' : 'Ban'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
