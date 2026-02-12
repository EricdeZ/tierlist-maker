import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { challengeService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import passionCoin from '../../assets/passion/passion.png'

const CATEGORIES = ['engagement', 'league', 'performance', 'social']
const TYPES = ['one_time', 'repeatable']
const STAT_KEYS = [
    { value: 'daily_logins', label: 'Daily Logins (count)' },
    { value: 'login_streak', label: 'Login Streak (current)' },
    { value: 'tier_lists_created', label: 'Tier Lists Created' },
    { value: 'drafts_completed', label: 'Drafts Completed' },
    { value: 'total_earned', label: 'Total Passion Earned' },
    { value: 'games_played', label: 'Games Played' },
    { value: 'leagues_joined', label: 'Leagues Joined' },
    { value: 'total_kills', label: 'Total Kills' },
    { value: 'total_assists', label: 'Total Assists' },
    { value: 'total_damage', label: 'Total Damage Dealt' },
    { value: 'total_mitigated', label: 'Total Damage Mitigated' },
]

const EMPTY_FORM = {
    title: '',
    description: '',
    category: 'engagement',
    type: 'one_time',
    reward: 10,
    target_value: 1,
    stat_key: 'daily_logins',
    repeat_cooldown: '',
    sort_order: 0,
}

export default function ChallengeManager() {
    const [challenges, setChallenges] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const loadChallenges = async () => {
        try {
            const data = await challengeService.adminGetAll()
            setChallenges(data.challenges || [])
        } catch (err) {
            console.error('Failed to load challenges:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadChallenges() }, [])

    const openCreate = () => {
        setForm(EMPTY_FORM)
        setEditingId(null)
        setError(null)
        setShowModal(true)
    }

    const openEdit = (ch) => {
        setForm({
            title: ch.title,
            description: ch.description || '',
            category: ch.category,
            type: ch.type,
            reward: ch.reward,
            target_value: ch.target_value,
            stat_key: ch.stat_key,
            repeat_cooldown: ch.repeat_cooldown || '',
            sort_order: ch.sort_order,
        })
        setEditingId(ch.id)
        setError(null)
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!form.title.trim() || !form.stat_key || !form.target_value) {
            setError('Title, stat key, and target value are required.')
            return
        }

        setSaving(true)
        setError(null)

        try {
            if (editingId) {
                await challengeService.update({ id: editingId, ...form })
            } else {
                await challengeService.create(form)
            }
            setShowModal(false)
            loadChallenges()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleToggle = async (id) => {
        try {
            await challengeService.toggle(id)
            loadChallenges()
        } catch (err) {
            console.error('Toggle failed:', err)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this challenge permanently?')) return
        try {
            await challengeService.remove(id)
            loadChallenges()
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text) p-4 sm:p-8">
            <PageTitle title="Challenge Manager" />

            {/* Header */}
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Link to="/admin" className="text-(--color-text-secondary) hover:text-(--color-text)">
                            <Home className="w-5 h-5" />
                        </Link>
                        <h1 className="text-2xl font-bold">Challenge Manager</h1>
                    </div>
                    <button onClick={openCreate}
                        className="px-4 py-2 rounded-lg bg-(--color-accent) hover:opacity-90 text-(--color-primary) font-bold text-sm transition-colors">
                        + New Challenge
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-(--color-text-secondary)">Loading...</div>
                ) : challenges.length === 0 ? (
                    <div className="text-center py-12 text-(--color-text-secondary)">
                        No challenges created yet. Click "New Challenge" to get started.
                    </div>
                ) : (
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-xs text-(--color-text-secondary) uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">Title</th>
                                    <th className="px-4 py-3 text-left hidden md:table-cell">Category</th>
                                    <th className="px-4 py-3 text-left hidden md:table-cell">Stat</th>
                                    <th className="px-4 py-3 text-center">Target</th>
                                    <th className="px-4 py-3 text-center">Reward</th>
                                    <th className="px-4 py-3 text-center">Type</th>
                                    <th className="px-4 py-3 text-center">Active</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {challenges.map(ch => (
                                    <tr key={ch.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${!ch.is_active ? 'opacity-50' : ''}`}>
                                        <td className="px-4 py-3 font-medium">{ch.title}</td>
                                        <td className="px-4 py-3 hidden md:table-cell capitalize text-(--color-text-secondary)">{ch.category}</td>
                                        <td className="px-4 py-3 hidden md:table-cell text-(--color-text-secondary) font-mono text-xs">{ch.stat_key}</td>
                                        <td className="px-4 py-3 text-center tabular-nums">{ch.target_value.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                                <span className="text-(--color-accent) font-bold">{ch.reward}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${ch.type === 'repeatable' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-(--color-text-secondary)'}`}>
                                                {ch.type === 'repeatable' ? 'Repeat' : 'Once'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => handleToggle(ch.id)}
                                                className={`w-8 h-5 rounded-full transition-colors ${ch.is_active ? 'bg-green-500' : 'bg-white/20'}`}>
                                                <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${ch.is_active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => openEdit(ch)}
                                                    className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                                                <button onClick={() => handleDelete(ch.id)}
                                                    className="text-xs text-red-400 hover:text-red-300">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowModal(false)}>
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit Challenge' : 'New Challenge'}</h2>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-(--color-text-secondary) mb-1">Title</label>
                                <input value={form.title} onChange={e => setField('title', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                    placeholder="e.g., Damage Dealer" />
                            </div>

                            <div>
                                <label className="block text-xs text-(--color-text-secondary) mb-1">Description</label>
                                <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                    placeholder="e.g., Deal 50,000 total damage across all games" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Category</label>
                                    <select value={form.category} onChange={e => setField('category', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50">
                                        {CATEGORIES.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Type</label>
                                    <select value={form.type} onChange={e => setField('type', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50">
                                        {TYPES.map(t => <option key={t} value={t} className="bg-gray-900">{t === 'one_time' ? 'One-Time' : 'Repeatable'}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-(--color-text-secondary) mb-1">Stat to Track</label>
                                <select value={form.stat_key} onChange={e => setField('stat_key', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50">
                                    {STAT_KEYS.map(s => <option key={s.value} value={s.value} className="bg-gray-900">{s.label}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Target Value</label>
                                    <input type="number" value={form.target_value} onChange={e => setField('target_value', parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50" />
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Reward</label>
                                    <div className="relative">
                                        <input type="number" value={form.reward} onChange={e => setField('reward', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50 pr-8" />
                                        <img src={passionCoin} alt="" className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Sort Order</label>
                                    <input type="number" value={form.sort_order} onChange={e => setField('sort_order', parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50" />
                                </div>
                            </div>

                            {form.type === 'repeatable' && (
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Repeat Cooldown (PostgreSQL interval)</label>
                                    <input value={form.repeat_cooldown} onChange={e => setField('repeat_cooldown', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                        placeholder="e.g., 7 days, 1 day" />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowModal(false)}
                                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-4 py-2 rounded-lg bg-(--color-accent) hover:opacity-90 text-(--color-primary) font-bold text-sm transition-colors disabled:opacity-50">
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Challenge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
