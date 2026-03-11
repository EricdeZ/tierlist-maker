import { useState, useEffect, useCallback } from 'react'
import PageTitle from '../../components/PageTitle'
import { vendingRestockService } from '../../services/database'

export default function VendingRestock() {
  const [sales, setSales] = useState([])
  const [packTypes, setPackTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ packTypeId: '', price: '', stock: '', name: '' })
  const [creating, setCreating] = useState(false)

  // Restock inline
  const [restockId, setRestockId] = useState(null)
  const [restockAmount, setRestockAmount] = useState('')

  // Edit inline
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', price: '', sortOrder: '' })

  const load = useCallback(async () => {
    try {
      const data = await vendingRestockService.load()
      setSales(data.sales)
      setPackTypes(data.packTypes)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!createForm.packTypeId || !createForm.stock) return
    setCreating(true)
    try {
      const data = await vendingRestockService.create({
        packTypeId: createForm.packTypeId,
        price: createForm.price ? parseInt(createForm.price) : undefined,
        stock: parseInt(createForm.stock),
        name: createForm.name || undefined,
      })
      setSales(prev => [data.sale, ...prev])
      setCreateForm({ packTypeId: '', price: '', stock: '', name: '' })
      setShowCreate(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRestock = async (id) => {
    const amount = parseInt(restockAmount)
    if (!amount || amount < 1) return
    try {
      const data = await vendingRestockService.restock(id, amount)
      setSales(prev => prev.map(s => s.id === id ? data.sale : s))
      setRestockId(null)
      setRestockAmount('')
    } catch (err) {
      setError(err.message)
    }
  }

  const startEdit = (sale) => {
    setEditId(sale.id)
    setEditForm({
      name: sale.name !== sale.baseName ? sale.name : '',
      price: String(sale.price),
      sortOrder: String(sale.sortOrder || 0),
    })
    setRestockId(null)
  }

  const handleEdit = async (id) => {
    try {
      const data = await vendingRestockService.edit(id, {
        name: editForm.name || undefined,
        price: editForm.price ? parseInt(editForm.price) : undefined,
        sortOrder: editForm.sortOrder ? parseInt(editForm.sortOrder) : undefined,
      })
      setSales(prev => prev.map(s => s.id === id ? data.sale : s))
      setEditId(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggle = async (id) => {
    try {
      const data = await vendingRestockService.toggle(id)
      setSales(prev => prev.map(s => s.id === id ? data.sale : s))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this sale listing?')) return
    try {
      await vendingRestockService.delete(id)
      setSales(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const selectedPackType = packTypes.find(p => p.id === createForm.packTypeId)

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-3xl mx-auto pb-8 px-4">
      <PageTitle title="Vending Restock" noindex />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Vending Restock</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors cursor-pointer"
        >
          {showCreate ? 'Cancel' : '+ Add Listing'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer">dismiss</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1">Pack Type</label>
              <select
                value={createForm.packTypeId}
                onChange={e => setCreateForm(f => ({ ...f, packTypeId: e.target.value, price: '' }))}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                required
              >
                <option value="">Select pack type...</option>
                {packTypes.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.cost} Cores, {p.cards} cards)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Stock</label>
              <input
                type="number"
                min="1"
                value={createForm.stock}
                onChange={e => setCreateForm(f => ({ ...f, stock: e.target.value }))}
                placeholder="Quantity"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Price (leave blank for default: {selectedPackType?.cost || '?'})</label>
              <input
                type="number"
                min="0"
                value={createForm.price}
                onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                placeholder={selectedPackType ? String(selectedPackType.cost) : 'Default'}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Display Name (optional override)</label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder={selectedPackType?.name || 'Pack name'}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !createForm.packTypeId || !createForm.stock}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {creating ? 'Creating...' : 'Create Listing'}
          </button>
        </form>
      )}

      {/* Sales table */}
      {sales.length === 0 ? (
        <div className="text-center py-12 text-white/40">No sale listings yet. Add one to stock the vending machine.</div>
      ) : (
        <div className="space-y-2">
          {sales.map(sale => (
            <div
              key={sale.id}
              className={`p-4 rounded-xl border transition-colors ${
                sale.active
                  ? sale.stock > 0
                    ? 'bg-white/5 border-white/10'
                    : 'bg-red-500/5 border-red-500/20'
                  : 'bg-white/[0.02] border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{sale.name}</span>
                    {sale.name !== sale.baseName && (
                      <span className="text-xs text-white/30">({sale.baseName})</span>
                    )}
                    {!sale.active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 uppercase tracking-wider font-bold">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                    <span>{sale.cards} cards</span>
                    <span>{sale.price} Cores{sale.price !== sale.baseCost ? ` (base: ${sale.baseCost})` : ''}</span>
                    <span>ID: {sale.packTypeId}</span>
                  </div>
                </div>

                {/* Stock */}
                <div className="text-right shrink-0">
                  <div className={`text-lg font-bold tabular-nums ${sale.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {sale.stock}
                    <span className="text-white/30 text-sm">/{sale.initialStock}</span>
                  </div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wider">stock</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {restockId === sale.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={restockAmount}
                        onChange={e => setRestockAmount(e.target.value)}
                        placeholder="Qty"
                        className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-sm text-white text-center"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleRestock(sale.id); if (e.key === 'Escape') { setRestockId(null); setRestockAmount(''); } }}
                      />
                      <button
                        onClick={() => handleRestock(sale.id)}
                        className="px-2 py-1 rounded text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setRestockId(null); setRestockAmount(''); }}
                        className="px-2 py-1 rounded text-xs text-white/40 hover:text-white/60 cursor-pointer"
                      >
                        x
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRestockId(sale.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer"
                      title="Restock"
                    >
                      Restock
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(sale)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggle(sale.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      sale.active
                        ? 'text-white/50 bg-white/5 hover:bg-white/10'
                        : 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                    }`}
                  >
                    {sale.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(sale.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editId === sale.id && (
                <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={sale.baseName}
                      className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm text-white"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Price (Cores)</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.price}
                      onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                      placeholder={String(sale.baseCost)}
                      className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={editForm.sortOrder}
                      onChange={e => setEditForm(f => ({ ...f, sortOrder: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm text-white"
                    />
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(sale.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white/70 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
