import { useState, useRef, useCallback } from 'react'

export default function useCodexCrud({ fieldApi, tagApi, groupTypeApi, fieldUpdateApi, fetchData }) {
    const [saving, setSaving] = useState(false)
    const [fieldForm, setFieldForm] = useState(null)
    const [tagForm, setTagForm] = useState(null)
    const [groupTypeForm, setGroupTypeForm] = useState(null)
    const [fieldPopup, setFieldPopup] = useState(null)
    const [showGroupTypes, setShowGroupTypes] = useState(false)
    const [showFields, setShowFields] = useState(false)
    const [showTags, setShowTags] = useState(false)

    // ── Field CRUD ──

    const startFieldCreate = (fieldsLength) => {
        setFieldForm({ slug: '', name: '', icon_url: '', description: '', field_type: 'text', required: false, sort_order: fieldsLength, sentence_template: '', group_type_id: null })
    }

    const startFieldEdit = (field) => {
        setFieldForm({ ...field })
    }

    const saveField = async () => {
        if (!fieldForm.name?.trim()) return
        setSaving(true)
        try {
            if (fieldForm.id) {
                await fieldApi.update(fieldForm)
            } else {
                await fieldApi.create(fieldForm)
            }
            setFieldForm(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteField = async (field, entityLabel = 'entity') => {
        if (!confirm(`Delete field "${field.name}"? This will remove the field definition. Existing ${entityLabel} values for this field will remain in their data but won't be displayed.`)) return
        try {
            await fieldApi.delete(field.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    // ── Tag CRUD ──

    const startTagCreate = () => {
        setTagForm({ name: '', color: '#6366f1' })
    }

    const startTagEdit = (tag) => {
        setTagForm({ ...tag })
    }

    const saveTag = async () => {
        if (!tagForm.name?.trim()) return
        setSaving(true)
        try {
            if (tagForm.id) {
                await tagApi.update(tagForm)
            } else {
                await tagApi.create(tagForm)
            }
            setTagForm(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteTag = async (tag, entityLabel = 'entities') => {
        if (!confirm(`Delete tag "${tag.name}"? It will be removed from all ${entityLabel}.`)) return
        try {
            await tagApi.delete(tag.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    // ── Sub-field builder helpers for group fields ──

    const updateSubField = (idx, key, value) => {
        setFieldForm(prev => {
            const subFields = [...(prev.options?.sub_fields || [])]
            subFields[idx] = { ...subFields[idx], [key]: value }
            return { ...prev, options: { ...prev.options, sub_fields: subFields } }
        })
    }

    const addSubField = () => {
        setFieldForm(prev => ({
            ...prev,
            options: { ...prev.options, sub_fields: [...(prev.options?.sub_fields || []), { key: '', label: '', type: 'number' }] }
        }))
    }

    const removeSubField = (idx) => {
        setFieldForm(prev => ({
            ...prev,
            options: { ...prev.options, sub_fields: (prev.options?.sub_fields || []).filter((_, i) => i !== idx) }
        }))
    }

    const moveSubField = (fromIdx, toIdx) => {
        setFieldForm(prev => {
            const subs = [...(prev.options?.sub_fields || [])]
            const [moved] = subs.splice(fromIdx, 1)
            subs.splice(toIdx, 0, moved)
            return { ...prev, options: { ...prev.options, sub_fields: subs } }
        })
    }

    // ── Group Type CRUD ──

    const startGroupTypeCreate = () => {
        setGroupTypeForm({ name: '', sub_fields: [{ key: '', label: '', type: 'number' }], sentence_template: '' })
    }

    const startGroupTypeEdit = (gt) => {
        setGroupTypeForm({ ...gt, sub_fields: Array.isArray(gt.sub_fields) ? [...gt.sub_fields] : [] })
    }

    const saveGroupType = async () => {
        if (!groupTypeForm.name?.trim()) return
        setSaving(true)
        try {
            if (groupTypeForm.id) {
                await groupTypeApi.update(groupTypeForm)
            } else {
                await groupTypeApi.create(groupTypeForm)
            }
            setGroupTypeForm(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteGroupType = async (gt) => {
        if (!confirm(`Delete group type "${gt.name}"? Fields using it will lose their sub-fields until reassigned.`)) return
        try {
            await groupTypeApi.delete(gt.id)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const updateGtSubField = (idx, key, value) => {
        setGroupTypeForm(prev => {
            const subs = [...(prev.sub_fields || [])]
            subs[idx] = { ...subs[idx], [key]: value }
            return { ...prev, sub_fields: subs }
        })
    }

    const addGtSubField = () => {
        setGroupTypeForm(prev => ({ ...prev, sub_fields: [...(prev.sub_fields || []), { key: '', label: '', type: 'number' }] }))
    }

    const removeGtSubField = (idx) => {
        setGroupTypeForm(prev => ({ ...prev, sub_fields: (prev.sub_fields || []).filter((_, i) => i !== idx) }))
    }

    const moveGtSubField = (fromIdx, toIdx) => {
        setGroupTypeForm(prev => {
            const subs = [...(prev.sub_fields || [])]
            const [moved] = subs.splice(fromIdx, 1)
            subs.splice(toIdx, 0, moved)
            return { ...prev, sub_fields: subs }
        })
    }

    // ── Field popup actions (save-as-type / link-to-type) ──

    const saveFieldAsType = async (field) => {
        const name = fieldPopup?.name?.trim()
        if (!name) return
        setSaving(true)
        try {
            const subFields = field.options?.sub_fields || []
            const result = await groupTypeApi.create({ name, sub_fields: subFields, sentence_template: field.sentence_template || null })
            await fieldUpdateApi({ id: field.id, group_type_id: result.groupType.id })
            setFieldPopup(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const linkFieldToType = async (fieldId) => {
        const typeId = fieldPopup?.typeId
        if (!typeId) return
        setSaving(true)
        try {
            await fieldUpdateApi({ id: fieldId, group_type_id: typeId })
            setFieldPopup(null)
            await fetchData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    // ── Text helpers ──

    const isLongText = (val) => typeof val === 'string' && val.length > 50

    const pendingFocus = useRef(null)

    const trackFocus = (key, el) => {
        if (!el) return
        pendingFocus.current = { key, pos: el.selectionStart ?? el.value?.length ?? 0 }
    }

    const fieldRef = useCallback((key) => (el) => {
        if (!el) return
        if (el.tagName === 'TEXTAREA') {
            el.style.height = 'auto'
            el.style.height = el.scrollHeight + 'px'
        }
        if (pendingFocus.current?.key === key) {
            const pos = pendingFocus.current.pos
            pendingFocus.current = null
            el.focus()
            el.setSelectionRange(pos, pos)
        }
    }, [])

    const autoResize = (el) => {
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
    }

    return {
        saving, setSaving,
        fieldForm, setFieldForm,
        tagForm, setTagForm,
        groupTypeForm, setGroupTypeForm,
        fieldPopup, setFieldPopup,
        showGroupTypes, setShowGroupTypes,
        showFields, setShowFields,
        showTags, setShowTags,
        // Field CRUD
        startFieldCreate, startFieldEdit, saveField, deleteField,
        // Tag CRUD
        startTagCreate, startTagEdit, saveTag, deleteTag,
        // Sub-field helpers
        updateSubField, addSubField, removeSubField, moveSubField,
        // Group Type CRUD
        startGroupTypeCreate, startGroupTypeEdit, saveGroupType, deleteGroupType,
        updateGtSubField, addGtSubField, removeGtSubField, moveGtSubField,
        // Field popup
        saveFieldAsType, linkFieldToType,
        // Text helpers
        isLongText, trackFocus, fieldRef, autoResize,
    }
}
