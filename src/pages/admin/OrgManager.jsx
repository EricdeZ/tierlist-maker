// src/pages/admin/OrgManager.jsx
import { useState, useEffect } from 'react'
import { orgService } from '../../services/database'
import { Building2, Plus, Pencil, Trash2, Link2, Unlink, ChevronDown, ChevronRight } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'

const OrgManager = () => {
    const [orgs, setOrgs] = useState([])
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [editingOrg, setEditingOrg] = useState(null) // null = create, object = edit
    const [formName, setFormName] = useState('')
    const [formColor, setFormColor] = useState('#6366f1')
    const [showForm, setShowForm] = useState(false)

    // Expanded org IDs for team assignment
    const [expandedOrg, setExpandedOrg] = useState(null)

    const fetchData = async () => {
        setLoading(true)
        try {
            const data = await orgService.adminGetAll()
            setOrgs(data.orgs || [])
            setTeams(data.teams || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const handleSave = async () => {
        if (!formName.trim()) return
        setSaving(true)
        try {
            if (editingOrg) {
                await orgService.update({ id: editingOrg.id, name: formName.trim(), color: formColor })
            } else {
                await orgService.create({ name: formName.trim(), color: formColor })
            }
            setShowForm(false)
            setEditingOrg(null)
            setFormName('')
            setFormColor('#6366f1')
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (org) => {
        if (!confirm(`Delete "${org.name}"? Teams will be unlinked.`)) return
        try {
            await orgService.remove(org.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const handleAssign = async (teamId, orgId) => {
        try {
            await orgService.assignTeam(teamId, orgId)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const handleUnassign = async (teamId) => {
        try {
            await orgService.unassignTeam(teamId)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const startEdit = (org) => {
        setEditingOrg(org)
        setFormName(org.name)
        setFormColor(org.color || '#6366f1')
        setShowForm(true)
    }

    const startCreate = () => {
        setEditingOrg(null)
        setFormName('')
        setFormColor('#6366f1')
        setShowForm(true)
    }

    const getOrgTeams = (orgId) => teams.filter(t => t.organization_id === orgId)
    const unassignedTeams = teams.filter(t => !t.organization_id)

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent border-white/20 mx-auto" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-(--color-accent)" />
                    <h1 className="font-heading text-2xl font-bold text-(--color-text)">Organizations</h1>
                    <span className="text-sm text-(--color-text-secondary)">({orgs.length})</span>
                </div>
                <button
                    onClick={startCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    New Org
                </button>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 mb-4 text-red-400 text-sm">{error}</div>
            )}

            {/* Create / Edit form */}
            {showForm && (
                <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-5 mb-6">
                    <h3 className="font-heading text-lg font-bold text-(--color-text) mb-4">
                        {editingOrg ? 'Edit Organization' : 'Create Organization'}
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Name</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)"
                                placeholder="Organization name"
                            />
                        </div>
                        <div className="w-32">
                            <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Color</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={formColor}
                                    onChange={e => setFormColor(e.target.value)}
                                    className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent"
                                />
                                <input
                                    type="text"
                                    value={formColor}
                                    onChange={e => setFormColor(e.target.value)}
                                    className="flex-1 px-2 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-xs font-mono focus:outline-none focus:border-(--color-accent)"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving || !formName.trim()}
                            className="px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : (editingOrg ? 'Update' : 'Create')}
                        </button>
                        <button
                            onClick={() => { setShowForm(false); setEditingOrg(null) }}
                            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-sm transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Orgs list */}
            <div className="space-y-3">
                {orgs.map(org => {
                    const orgTeams = getOrgTeams(org.id)
                    const isExpanded = expandedOrg === org.id

                    return (
                        <div key={org.id} className="bg-(--color-secondary) border border-white/10 rounded-xl overflow-hidden">
                            {/* Org header */}
                            <div className="flex items-center gap-3 p-4">
                                <button
                                    onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                                    className="shrink-0 cursor-pointer"
                                >
                                    {isExpanded
                                        ? <ChevronDown className="w-4 h-4 text-(--color-text-secondary)" />
                                        : <ChevronRight className="w-4 h-4 text-(--color-text-secondary)" />
                                    }
                                </button>

                                <div
                                    className="w-4 h-4 rounded-full shrink-0"
                                    style={{ backgroundColor: org.color }}
                                />

                                <div className="flex-1 min-w-0">
                                    <span className="font-heading text-sm font-bold text-(--color-text)">{org.name}</span>
                                    <span className="text-xs text-(--color-text-secondary) ml-2">
                                        {orgTeams.length} team{orgTeams.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => startEdit(org)}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer"
                                        title="Edit"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(org)}
                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Expanded: teams list + assign */}
                            {isExpanded && (
                                <div className="border-t border-white/5 px-4 py-3">
                                    {orgTeams.length === 0 ? (
                                        <p className="text-sm text-(--color-text-secondary) py-2">No teams assigned.</p>
                                    ) : (
                                        <div className="space-y-1 mb-3">
                                            {orgTeams.map(t => (
                                                <div key={t.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                                                    <TeamLogo slug={t.slug} name={t.name} size={20} />
                                                    <div
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: t.color }}
                                                    />
                                                    <span className="text-sm text-(--color-text) flex-1 truncate">{t.name}</span>
                                                    <span className="text-xs text-(--color-text-secondary) truncate">
                                                        {t.league_name} · {t.division_name} · {t.season_name}
                                                    </span>
                                                    <button
                                                        onClick={() => handleUnassign(t.id)}
                                                        className="p-1 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer"
                                                        title="Remove from org"
                                                    >
                                                        <Unlink className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Assign unassigned teams */}
                                    {unassignedTeams.length > 0 && (
                                        <div className="border-t border-white/5 pt-3">
                                            <p className="text-xs text-(--color-text-secondary) uppercase tracking-wider mb-2">
                                                Assign unlinked teams
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {unassignedTeams.map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => handleAssign(t.id, org.id)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-(--color-accent)/10 text-xs text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer"
                                                        title={`${t.league_name} · ${t.division_name} · ${t.season_name}`}
                                                    >
                                                        <Link2 className="w-3 h-3" />
                                                        {t.name}
                                                        <span className="text-(--color-text-secondary)/40">({t.season_name})</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {orgs.length === 0 && (
                <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-12 text-center">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-(--color-text-secondary)/30" />
                    <p className="text-(--color-text-secondary) text-lg font-medium font-heading">No organizations yet</p>
                    <p className="text-(--color-text-secondary)/50 text-sm mt-1">Create one to group teams together</p>
                </div>
            )}

            {/* Unassigned teams section */}
            {unassignedTeams.length > 0 && (
                <div className="mt-8">
                    <h2 className="font-heading text-lg font-bold text-(--color-text) mb-3">
                        Unassigned Teams ({unassignedTeams.length})
                    </h2>
                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl overflow-hidden">
                        <div className="divide-y divide-white/5">
                            {unassignedTeams.map(t => (
                                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                                    <TeamLogo slug={t.slug} name={t.name} size={20} />
                                    <div
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: t.color }}
                                    />
                                    <span className="text-sm text-(--color-text) flex-1 truncate">{t.name}</span>
                                    <span className="text-xs text-(--color-text-secondary) truncate">
                                        {t.league_name} · {t.division_name} · {t.season_name}
                                    </span>
                                    {orgs.length > 0 && (
                                        <select
                                            onChange={e => { if (e.target.value) handleAssign(t.id, Number(e.target.value)); e.target.value = '' }}
                                            defaultValue=""
                                            className="px-2 py-1 bg-black/20 border border-white/10 rounded text-xs text-(--color-text) cursor-pointer focus:outline-none"
                                        >
                                            <option value="">Assign to...</option>
                                            {orgs.map(o => (
                                                <option key={o.id} value={o.id}>{o.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default OrgManager
