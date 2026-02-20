import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Sparkles, ExternalLink } from 'lucide-react'
import patchNotesRaw from '../data/patch-notes.md?raw'

const STORAGE_KEY = 'whats-new-hash'

// Simple hash for detecting content changes
function hashString(str) {
    let hash = 5381
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
    }
    return hash.toString(36)
}

// Minimal markdown → React elements
function renderMarkdown(md, onNavigate) {
    const lines = md.split('\n')
    const elements = []
    let listItems = []
    let key = 0

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(<ul key={key++} className="list-disc list-inside space-y-1 text-sm text-(--color-text-secondary) mb-3">{listItems}</ul>)
            listItems = []
        }
    }

    const inlineFormat = (text) => {
        // Links, bold, italic, inline code
        const parts = []
        const regex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
        let lastIndex = 0
        let match
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
            if (match[2] && match[3]) {
                const href = match[3]
                const isInternal = href.startsWith('/')
                parts.push(
                    <a
                        key={`a${match.index}`}
                        href={href}
                        onClick={isInternal ? (e) => { e.preventDefault(); onNavigate(href) } : undefined}
                        target={isInternal ? undefined : '_blank'}
                        rel={isInternal ? undefined : 'noopener noreferrer'}
                        className="inline-flex items-center gap-1 text-(--color-accent) underline underline-offset-2 decoration-(--color-accent)/40 hover:decoration-(--color-accent) cursor-pointer transition-colors"
                    >{match[2]}<ExternalLink className="w-3 h-3 inline shrink-0" /></a>
                )
            }
            else if (match[4]) parts.push(<strong key={`b${match.index}`} className="text-(--color-text) font-semibold">{match[4]}</strong>)
            else if (match[5]) parts.push(<em key={`i${match.index}`} className="italic">{match[5]}</em>)
            else if (match[6]) parts.push(<code key={`c${match.index}`} className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">{match[6]}</code>)
            lastIndex = regex.lastIndex
        }
        if (lastIndex < text.length) parts.push(text.slice(lastIndex))
        return parts.length > 0 ? parts : text
    }

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) { flushList(); continue }

        if (trimmed.startsWith('# ')) {
            flushList()
            elements.push(<h1 key={key++} className="font-heading text-xl font-bold text-(--color-text) mb-3">{inlineFormat(trimmed.slice(2))}</h1>)
        } else if (trimmed.startsWith('## ')) {
            flushList()
            elements.push(<h2 key={key++} className="font-heading text-base font-bold text-(--color-accent) mt-4 mb-2">{inlineFormat(trimmed.slice(3))}</h2>)
        } else if (trimmed.startsWith('### ')) {
            flushList()
            elements.push(<h3 key={key++} className="font-heading text-sm font-bold text-(--color-text) mt-3 mb-1">{inlineFormat(trimmed.slice(4))}</h3>)
        } else if (trimmed === '---' || trimmed === '***') {
            flushList()
            elements.push(<hr key={key++} className="border-white/10 my-4" />)
        } else if (/^[-*] /.test(trimmed)) {
            listItems.push(<li key={key++}>{inlineFormat(trimmed.slice(2))}</li>)
        } else {
            flushList()
            elements.push(<p key={key++} className="text-sm text-(--color-text-secondary) mb-2">{inlineFormat(trimmed)}</p>)
        }
    }
    flushList()
    return elements
}

export default function WhatsNewModal() {
    const [open, setOpen] = useState(false)
    const modalRef = useRef(null)
    const navigate = useNavigate()
    const contentHash = useRef(hashString(patchNotesRaw))

    // Auto-show if patch notes changed since last dismissal
    useEffect(() => {
        const seen = localStorage.getItem(STORAGE_KEY)
        if (seen !== contentHash.current) {
            // Small delay so the app finishes rendering first
            const timer = setTimeout(() => setOpen(true), 600)
            return () => clearTimeout(timer)
        }
    }, [])

    // Also allow manual open via custom event
    useEffect(() => {
        const handler = () => setOpen(true)
        window.addEventListener('open-whats-new', handler)
        return () => window.removeEventListener('open-whats-new', handler)
    }, [])

    // Close on click outside
    useEffect(() => {
        if (!open) return
        const handle = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) dismiss()
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [open])

    // Close on escape
    useEffect(() => {
        if (!open) return
        const handle = (e) => { if (e.key === 'Escape') dismiss() }
        document.addEventListener('keydown', handle)
        return () => document.removeEventListener('keydown', handle)
    }, [open])

    const dismiss = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, contentHash.current)
        setOpen(false)
    }, [])

    const handleNavigate = useCallback((path) => {
        setOpen(false)
        navigate(path)
    }, [navigate])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div ref={modalRef} className="w-full max-w-lg bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-(--color-accent)" />
                        <h2 className="font-heading text-lg font-bold text-(--color-text)">What's New</h2>
                    </div>
                    <button onClick={dismiss} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5 text-(--color-text-secondary)" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {renderMarkdown(patchNotesRaw, handleNavigate)}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 flex justify-end">
                    <button
                        onClick={dismiss}
                        className="px-5 py-2 rounded-lg bg-(--color-accent) text-(--color-primary) font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    )
}
