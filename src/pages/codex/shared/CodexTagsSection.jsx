import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Tag } from 'lucide-react'

export default function CodexTagsSection({
    tags, tagForm, setTagForm,
    showTags, setShowTags,
    startTagCreate, startTagEdit, saveTag, deleteTag,
    saving,
    entityLabel = 'entities',
}) {
    return (
        <div className="mb-6">
            <button
                onClick={() => setShowTags(!showTags)}
                className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-xl bg-(--color-secondary) border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
            >
                {showTags ? <ChevronDown className="w-4 h-4 text-(--color-text-secondary)" /> : <ChevronRight className="w-4 h-4 text-(--color-text-secondary)" />}
                <Tag className="w-4 h-4 text-emerald-400" />
                <span className="font-heading text-sm font-bold text-(--color-text)">Tags</span>
                <span className="text-xs text-(--color-text-secondary)">({tags.length})</span>
                <span className="text-xs text-(--color-text-secondary)/50 ml-auto">Categorize {entityLabel} with tags</span>
            </button>

            {showTags && (
                <div className="mt-2 bg-(--color-secondary) border border-white/10 rounded-xl p-4">
                    {/* Tag chips */}
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {tags.map(tag => (
                                <div key={tag.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 group">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color || '#6366f1' }} />
                                    <span className="text-sm text-(--color-text)">{tag.name}</span>
                                    <button onClick={() => startTagEdit(tag)} className="p-0.5 rounded hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors cursor-pointer opacity-0 group-hover:opacity-100" title="Edit">
                                        <Pencil className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => deleteTag(tag)} className="p-0.5 rounded hover:bg-red-500/10 text-(--color-text-secondary) hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100" title="Delete">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tag form */}
                    {tagForm ? (
                        <div className="border border-white/10 rounded-lg p-4 bg-black/10">
                            <h4 className="text-sm font-bold text-(--color-text) mb-3">{tagForm.id ? 'Edit Tag' : 'New Tag'}</h4>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Name *</label>
                                    <input type="text" value={tagForm.name} onChange={e => setTagForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)" placeholder="Tag name" />
                                </div>
                                <div className="w-32">
                                    <label className="block text-xs text-(--color-text-secondary) uppercase tracking-wider mb-1">Color</label>
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={tagForm.color || '#6366f1'} onChange={e => setTagForm(p => ({ ...p, color: e.target.value }))}
                                            className="w-10 h-10 rounded border border-white/10 cursor-pointer bg-transparent" />
                                        <input type="text" value={tagForm.color || ''} onChange={e => setTagForm(p => ({ ...p, color: e.target.value }))}
                                            className="flex-1 px-2 py-2 bg-black/20 border border-white/10 rounded-lg text-(--color-text) text-xs font-mono focus:outline-none focus:border-(--color-accent)" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-4">
                                <button onClick={saveTag} disabled={saving || !tagForm.name?.trim()}
                                    className="px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent)/80 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
                                    {saving ? 'Saving...' : (tagForm.id ? 'Update' : 'Create')}
                                </button>
                                <button onClick={() => setTagForm(null)}
                                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) text-sm transition-colors cursor-pointer">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={startTagCreate}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) text-sm transition-colors cursor-pointer">
                            <Plus className="w-3.5 h-3.5" /> Add Tag
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
