import { useState, useEffect } from 'react'
import { vaultService } from '../../services/database'
import PageTitle from '../../components/PageTitle'

export default function RedeemCodes() {
  const [codes, setCodes] = useState([])
  const [packTypes, setPackTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ code: '', packTypeId: '', mode: 'per_person', maxUses: '', expiresAt: '' })

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const [codesData, clashData] = await Promise.all([
        vaultService.adminListRedeemCodes(),
        vaultService.load(),
      ])
      setCodes(codesData.codes || [])
      setPackTypes(clashData.packTypes || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.code.trim() || !form.packTypeId) return
    setCreating(true)
    setError(null)
    try {
      await vaultService.adminCreateRedeemCode({
        code: form.code.trim(),
        packTypeId: form.packTypeId,
        mode: form.mode,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
      })
      setForm({ code: '', packTypeId: '', mode: 'per_person', maxUses: '', expiresAt: '' })
      await load()
    } catch (err) {
      setError(err.message || 'Failed to create code')
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (codeId, active) => {
    try {
      await vaultService.adminToggleRedeemCode(codeId, active)
      setCodes(prev => prev.map(c => c.id === codeId ? { ...c, active } : c))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="loading-spinner w-8 h-8" /></div>

  return (
    <div className="max-w-4xl mx-auto pb-8 px-4">
      <PageTitle title="Redeem Codes" noindex />
      <h1 className="text-2xl font-bold mb-6">Redeem Codes</h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer">dismiss</button>
        </div>
      )}

      {/* Create form */}
      <div className="bg-[var(--color-card,var(--color-secondary))] rounded-xl border border-[var(--color-border)] p-5 mb-8">
        <h2 className="text-lg font-semibold mb-4">Create New Code</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SPRING2026"
                required
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Pack Type</label>
              <select
                value={form.packTypeId}
                onChange={(e) => setForm(f => ({ ...f, packTypeId: e.target.value }))}
                required
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Select pack...</option>
                {packTypes.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.cards} cards)</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Mode</label>
              <select
                value={form.mode}
                onChange={(e) => setForm(f => ({ ...f, mode: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="single">Single Use</option>
                <option value="per_person">Per Person</option>
              </select>
            </div>
            {form.mode === 'per_person' && (
              <>
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Max Uses <span className="text-[var(--color-text-secondary)]">(optional)</span></label>
                  <input
                    type="number"
                    value={form.maxUses}
                    onChange={(e) => setForm(f => ({ ...f, maxUses: e.target.value }))}
                    placeholder="Unlimited"
                    min="1"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Expires <span className="text-[var(--color-text-secondary)]">(optional)</span></label>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={creating || !form.code.trim() || !form.packTypeId}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {creating ? 'Creating...' : 'Create Code'}
          </button>
        </form>
      </div>

      {/* Codes table */}
      <div className="bg-[var(--color-card,var(--color-secondary))] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold">All Codes ({codes.length})</h2>
        </div>

        {codes.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">No codes created yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Pack</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Uses</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {codes.map(c => {
                  const expired = c.expiresAt && new Date(c.expiresAt) < new Date()
                  const maxed = c.maxUses != null && c.timesRedeemed >= c.maxUses
                  const statusLabel = !c.active ? 'Inactive' : expired ? 'Expired' : maxed ? 'Maxed' : 'Active'
                  const statusColor = statusLabel === 'Active'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-red-400 bg-red-500/10'

                  return (
                    <tr key={c.id} className="border-b border-[var(--color-border)] last:border-b-0">
                      <td className="px-4 py-3 font-mono font-bold tracking-wider">{c.code}</td>
                      <td className="px-4 py-3">{c.packName || c.packTypeId}</td>
                      <td className="px-4 py-3 capitalize">{c.mode === 'per_person' ? 'Per Person' : 'Single'}</td>
                      <td className="px-4 py-3">
                        {c.timesRedeemed}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(c.id, !c.active)}
                          className="text-xs underline cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                        >
                          {c.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
