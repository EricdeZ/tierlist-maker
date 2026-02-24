/**
 * Generates human-readable sentences from codex item/god field values.
 * Supports DB-stored sentence templates with conditional sections,
 * plus a generic fallback for fields without templates.
 *
 * Template syntax:
 *   {key}              — replaced with sub-field value (or {value} for scalar fields)
 *   [{key}]            — conditional: section only shown if {key} has a non-empty value
 *   [text {key} text]  — conditional: entire section shown/hidden based on {key}
 *   {key:label}        — for booleans: section shown if truthy, outputs "label" instead of value
 */

function formatSimpleValue(type, value) {
    if (type === 'boolean') return value ? 'Yes' : 'No'
    if (type === 'percentage') return `${value}%`
    return String(value)
}

function getValidSubValues(field, value) {
    if (!value || typeof value !== 'object' || !field.options?.sub_fields) return []
    return field.options.sub_fields
        .filter(sf => {
            const v = value[sf.key]
            return sf.type === 'boolean' ? v !== undefined : (v !== '' && v != null)
        })
        .map(sf => ({ subField: sf, val: value[sf.key] }))
}

function genericGroupDescription(field, value) {
    const entries = getValidSubValues(field, value)
    if (entries.length === 0) return ''
    return entries
        .map(({ subField, val }) => `${subField.label}: ${formatSimpleValue(subField.type, val)}`)
        .join(', ')
}

/**
 * Build a lookup map of sub-field keys to their types for boolean detection.
 */
function getSubFieldTypes(field) {
    const types = {}
    if (field.options?.sub_fields) {
        for (const sf of field.options.sub_fields) {
            types[sf.key] = sf.type
        }
    }
    return types
}

/**
 * Resolve a {key} or {key:label} placeholder against the value object.
 * Returns { found: boolean, replacement: string }
 */
function resolvePlaceholder(token, values, subFieldTypes) {
    const colonIdx = token.indexOf(':')
    const key = colonIdx >= 0 ? token.slice(0, colonIdx) : token
    const label = colonIdx >= 0 ? token.slice(colonIdx + 1) : null
    const raw = key === 'value' ? values : values?.[key]
    const type = subFieldTypes[key]

    // Empty check
    if (raw === undefined || raw === null || raw === '') return { found: false, replacement: '' }

    // Boolean sub-field with label syntax: {key:text to show if true}
    if (type === 'boolean' || typeof raw === 'boolean') {
        if (!raw) return { found: false, replacement: '' }
        return { found: true, replacement: label || 'Yes' }
    }

    // Non-empty value
    if (label) {
        // {key:label} for non-booleans — show label if key has a value
        return { found: true, replacement: label }
    }
    return { found: true, replacement: String(raw) }
}

/**
 * Apply a sentence template to a field value.
 * Processes conditional [...] sections and {key} placeholders.
 */
function applyTemplate(template, field, value) {
    const subFieldTypes = getSubFieldTypes(field)
    const values = field.field_type === 'group' ? (value || {}) : value

    // Only match {key} or {key:label} where key is a valid identifier (letters, digits, underscores)
    const placeholderRe = /\{([a-zA-Z_][a-zA-Z0-9_]*(?::[^}]*)?)\}/g

    // Process conditional sections: [...] blocks
    // Sections are kept only if ALL {key} refs inside resolve to non-empty
    let result = template.replace(/\[([^\[\]]*)\]/g, (_, section) => {
        const placeholders = [...section.matchAll(placeholderRe)]
        if (placeholders.length === 0) return section

        let output = section
        let allFound = true
        for (const match of placeholders) {
            const { found, replacement } = resolvePlaceholder(match[1], values, subFieldTypes)
            if (!found) { allFound = false; break }
            output = output.replace(match[0], replacement)
        }
        return allFound ? output : ''
    })

    // Process any remaining top-level {key} placeholders (outside [...] blocks)
    result = result.replace(placeholderRe, (match, token) => {
        const { replacement } = resolvePlaceholder(token, values, subFieldTypes)
        return replacement
    })

    // Clean up: collapse separators left by removed conditional sections
    result = result
        .replace(/(\w)\s+,\s/g, '$1 ')     // "Affects , one ally" → "Affects one ally"
        .replace(/,\s*,+/g, ',')           // collapse double commas
        .replace(/\+\s*\+/g, '+')          // collapse double pluses
        .replace(/\s{2,}/g, ' ')           // collapse multiple spaces
        .replace(/^[\s,+]+|[\s,+]+$/g, '') // trim leading/trailing separators
        .trim()

    return result
}

export function describeFieldValue(field, value) {
    if (value === undefined || value === null || value === '') return ''

    // Use DB-stored sentence template if available
    if (field.sentence_template) {
        const result = applyTemplate(field.sentence_template, field, value)
        if (result) return result
    }

    // Fallback: generic group description or simple value formatting
    if (field.field_type === 'group') {
        return genericGroupDescription(field, value)
    }

    return formatSimpleValue(field.field_type, value)
}
