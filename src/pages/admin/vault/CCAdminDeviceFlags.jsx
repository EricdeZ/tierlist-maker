import { useState, useEffect, useCallback } from 'react'
import { vaultAdminService } from '../../../services/database'

function truncate(str, len = 16) {
  if (!str) return '—'
  return str.length > len ? str.slice(0, len) + '…' : str
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function CCAdminDeviceFlags() {
  const [flags, setFlags] = useState([])
  const [flagsLoading, setFlagsLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState(null)

  const [lookupName, setLookupName] = useState('')
  const [investigating, setInvestigating] = useState(false)
  const [matches, setMatches] = useState(null)
  const [investigateError, setInvestigateError] = useState(null)

  const [activityLog, setActivityLog] = useState([])
  const [logLoading, setLogLoading] = useState(true)

  const fetchFlags = useCallback(async () => {
    setFlagsLoading(true)
    try {
      const data = await vaultAdminService.getDeviceFlags()
      setFlags(data.flags || [])
    } catch (err) {
      console.error('Failed to load device flags:', err)
    } finally {
      setFlagsLoading(false)
    }
  }, [])

  const fetchLog = useCallback(async () => {
    setLogLoading(true)
    try {
      const data = await vaultAdminService.getRecentDeviceLog()
      setActivityLog(data.logs || [])
    } catch (err) {
      console.error('Failed to load activity log:', err)
    } finally {
      setLogLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlags()
    fetchLog()
  }, [fetchFlags, fetchLog])

  const handleResolve = async (flagId) => {
    setResolvingId(flagId)
    try {
      await vaultAdminService.resolveDeviceFlag(flagId)
      await fetchFlags()
    } catch (err) {
      console.error('Failed to resolve flag:', err)
    } finally {
      setResolvingId(null)
    }
  }

  const handleInvestigate = useCallback(async () => {
    const name = lookupName.trim()
    if (!name) return
    setInvestigating(true)
    setMatches(null)
    setInvestigateError(null)
    try {
      const data = await vaultAdminService.investigateUser(name)
      if (data.error) {
        setInvestigateError(data.error)
      } else {
        setMatches(data)
      }
    } catch (err) {
      setInvestigateError(err.message || 'Investigation failed')
    } finally {
      setInvestigating(false)
    }
  }, [lookupName])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleInvestigate()
  }

  return (
    <div className="space-y-6">
      {/* Flags Panel */}
      <div>
        <h2 className="text-lg font-bold text-[var(--cd-cyan)] cd-head mb-4">Device Flags</h2>

        {flagsLoading ? (
          <div className="flex justify-center py-8">
            <div className="cd-spinner w-6 h-6" />
          </div>
        ) : flags.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No device flags found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                  <th className="p-3">User A</th>
                  <th className="p-3">User B</th>
                  <th className="p-3">Device</th>
                  <th className="p-3">Flagged</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flags.map(flag => (
                  <tr
                    key={flag.id}
                    className={`border-b border-white/5 transition-opacity ${flag.resolved ? 'opacity-40' : ''}`}
                  >
                    <td className="p-3">
                      <div className="font-medium">{flag.user_a_name || '—'}</div>
                      {flag.user_a_discord_id && (
                        <div className="text-xs text-[var(--color-text-secondary)]">#{flag.user_a_discord_id}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{flag.user_b_name || '—'}</div>
                      {flag.user_b_discord_id && (
                        <div className="text-xs text-[var(--color-text-secondary)]">#{flag.user_b_discord_id}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs text-[var(--color-text-secondary)]">
                      {truncate(flag.device_id, 16)}
                    </td>
                    <td className="p-3 text-xs text-[var(--color-text-secondary)]">
                      {formatDate(flag.flagged_at)}
                    </td>
                    <td className="p-3">
                      {flag.resolved ? (
                        <span className="px-2 py-0.5 rounded bg-white/10 text-white/50 text-xs font-bold">Resolved</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-bold">Unresolved</span>
                      )}
                    </td>
                    <td className="p-3">
                      {!flag.resolved && (
                        <button
                          onClick={() => handleResolve(flag.id)}
                          disabled={resolvingId === flag.id}
                          className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors cursor-pointer disabled:opacity-30"
                        >
                          {resolvingId === flag.id ? '…' : 'Resolve'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lookup Tool */}
      <div>
        <h2 className="text-lg font-bold text-[var(--cd-cyan)] cd-head mb-4">Lookup Tool</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={lookupName}
            onChange={e => setLookupName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Discord username..."
            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--cd-cyan)]/50"
          />
          <button
            onClick={handleInvestigate}
            disabled={investigating || !lookupName.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--cd-cyan)]/20 text-[var(--cd-cyan)] text-sm font-bold hover:bg-[var(--cd-cyan)]/30 disabled:opacity-30 transition-colors cursor-pointer cd-head"
          >
            {investigating ? 'Investigating…' : 'Investigate'}
          </button>
        </div>

        {investigateError && (
          <p className="text-sm text-red-400 mb-4">{investigateError}</p>
        )}

        {matches && (
          matches.matches.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No matches found for this user.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                    <th className="p-3">User</th>
                    <th className="p-3">IP</th>
                    <th className="p-3">Device</th>
                    <th className="p-3">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.matches.map((m, i) => {
                    const sharedIp = matches.targetIps?.includes(m.ip_address)
                    const sharedDevice = matches.targetDevices?.includes(m.device_id)
                    const both = sharedIp && sharedDevice

                    let signalLabel = null
                    let signalClass = ''
                    if (both) {
                      signalLabel = 'IP + Device'
                      signalClass = 'text-red-400 font-bold'
                    } else if (sharedIp) {
                      signalLabel = 'IP only'
                      signalClass = 'text-yellow-400'
                    } else if (sharedDevice) {
                      signalLabel = 'Device only'
                      signalClass = 'text-orange-400'
                    }

                    return (
                      <tr
                        key={i}
                        className={`border-b border-white/5 ${both ? 'bg-red-500/10' : ''}`}
                      >
                        <td className="p-3">
                          <div className="font-medium">{m.discord_username || '—'}</div>
                          {m.discord_id && (
                            <div className="text-xs text-[var(--color-text-secondary)]">#{m.discord_id}</div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs text-[var(--color-text-secondary)]">
                          {m.ip_address || '—'}
                        </td>
                        <td className="p-3 font-mono text-xs text-[var(--color-text-secondary)]">
                          {truncate(m.device_id, 16)}
                        </td>
                        <td className={`p-3 text-xs ${signalClass}`}>
                          {signalLabel || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Activity Log */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-[var(--cd-cyan)] cd-head">Recent Logins</h2>
          <button
            onClick={fetchLog}
            disabled={logLoading}
            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors cursor-pointer disabled:opacity-30"
          >
            {logLoading ? '...' : 'Refresh'}
          </button>
        </div>

        {logLoading ? (
          <div className="flex justify-center py-8">
            <div className="cd-spinner w-6 h-6" />
          </div>
        ) : activityLog.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No login activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-white/10">
                  <th className="p-3">User</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Device</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {activityLog.map(log => (
                  <tr key={log.id} className="border-b border-white/5">
                    <td className="p-3">
                      <span className="font-medium">{log.discord_username || '—'}</span>
                      <span className="text-xs text-white/30 ml-1">#{log.user_id}</span>
                    </td>
                    <td className="p-3 font-mono text-xs text-[var(--color-text-secondary)]">{log.ip_address || '—'}</td>
                    <td className="p-3 font-mono text-xs text-[var(--color-text-secondary)]">{truncate(log.device_id, 16)}</td>
                    <td className="p-3 text-xs text-[var(--color-text-secondary)]">{formatTime(log.logged_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
