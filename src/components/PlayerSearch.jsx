import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'

const HighlightText = ({ text, query }) => {
    if (!query) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-(--color-accent)/30 text-(--color-text) rounded-sm px-0.5">
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    )
}

const PlayerSearch = ({ players, playerSlugMap, basePath, roleImages, searchTerm, onSearchChange }) => {
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)

    const containerRef = useRef(null)
    const inputRef = useRef(null)
    const listRef = useRef(null)

    const suggestions = useMemo(() => {
        if (!searchTerm || searchTerm.length < 1) return []
        const term = searchTerm.toLowerCase()
        return players
            .filter(p => p.name.toLowerCase().includes(term))
            .slice(0, 8)
    }, [players, searchTerm])

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return
        const handle = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [isOpen])

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightIndex < 0 || !listRef.current) return
        const item = listRef.current.children[highlightIndex]
        if (item) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, [highlightIndex])

    const navigateToPlayer = (player) => {
        const slug = playerSlugMap[player.id]
        if (slug) navigate(`${basePath}/players/${slug}`)
        setIsOpen(false)
    }

    const handleChange = (e) => {
        const value = e.target.value
        onSearchChange(value)
        setHighlightIndex(-1)
        setIsOpen(value.length >= 1)
    }

    const handleClear = () => {
        onSearchChange('')
        setIsOpen(false)
        setHighlightIndex(-1)
        inputRef.current?.focus()
    }

    const handleKeyDown = (e) => {
        if (!isOpen || suggestions.length === 0) {
            if (e.key === 'ArrowDown' && suggestions.length > 0) {
                setIsOpen(true)
                setHighlightIndex(0)
                e.preventDefault()
            }
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0)
                break
            case 'ArrowUp':
                e.preventDefault()
                setHighlightIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1)
                break
            case 'Enter':
                e.preventDefault()
                if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
                    navigateToPlayer(suggestions[highlightIndex])
                }
                break
            case 'Escape':
                setIsOpen(false)
                setHighlightIndex(-1)
                inputRef.current?.blur()
                break
        }
    }

    const showDropdown = isOpen && searchTerm.length >= 1

    return (
        <div ref={containerRef} className="relative">
            <label htmlFor="player-search" className="block text-sm font-medium text-(--color-text-secondary) mb-1">
                Search Players
            </label>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary) pointer-events-none" />
                <input
                    ref={inputRef}
                    id="player-search"
                    type="text"
                    role="combobox"
                    aria-expanded={showDropdown && suggestions.length > 0}
                    aria-autocomplete="list"
                    aria-controls="player-search-listbox"
                    aria-activedescendant={highlightIndex >= 0 ? `player-option-${highlightIndex}` : undefined}
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (searchTerm.length >= 1) setIsOpen(true) }}
                    className="w-full pl-10 pr-10 py-2 bg-(--color-primary) border border-white/10 rounded-md text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:ring-2 focus:ring-(--color-accent)/50 transition-all"
                />
                {searchTerm && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary) hover:text-(--color-text) transition-colors"
                        tabIndex={-1}
                        aria-label="Clear search"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Dropdown */}
            <div
                className={`absolute z-50 top-full left-0 right-0 mt-1 bg-(--color-secondary) border border-white/10 rounded-xl shadow-2xl overflow-hidden transition-all duration-150 ease-out origin-top ${
                    showDropdown
                        ? 'opacity-100 scale-y-100 translate-y-0'
                        : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
                }`}
            >
                {suggestions.length > 0 ? (
                    <ul
                        ref={listRef}
                        id="player-search-listbox"
                        role="listbox"
                        className="py-1 max-h-[360px] overflow-y-auto"
                    >
                        {suggestions.map((player, index) => {
                            const isHighlighted = index === highlightIndex
                            return (
                                <li
                                    key={player.id}
                                    id={`player-option-${index}`}
                                    role="option"
                                    aria-selected={isHighlighted}
                                    onMouseEnter={() => setHighlightIndex(index)}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        navigateToPlayer(player)
                                    }}
                                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                        isHighlighted ? 'bg-white/10' : 'hover:bg-white/5'
                                    }`}
                                >
                                    {/* Role icon */}
                                    {player.role && roleImages[player.role.toUpperCase()] && (
                                        <img
                                            src={roleImages[player.role.toUpperCase()]}
                                            alt={player.role}
                                            className="w-6 h-6 object-contain flex-shrink-0"
                                        />
                                    )}

                                    {/* Name + team */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-(--color-text) truncate">
                                            <HighlightText text={player.name} query={searchTerm} />
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span
                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: player.team.color }}
                                            />
                                            <span className="text-xs text-(--color-text-secondary) truncate">
                                                {player.team.name}
                                            </span>
                                        </div>
                                    </div>

                                    {/* KDA badge */}
                                    <div className="flex-shrink-0 text-right">
                                        <span className={`text-sm font-bold ${
                                            player.kda >= 2 ? 'text-green-400' :
                                            player.kda >= 1.5 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>
                                            {player.kda.toFixed(2)}
                                        </span>
                                        <div className="text-[10px] text-(--color-text-secondary) uppercase tracking-wider">
                                            KDA
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <p className="px-3 py-4 text-sm text-(--color-text-secondary) text-center">
                        No players found
                    </p>
                )}
            </div>
        </div>
    )
}

export default PlayerSearch
