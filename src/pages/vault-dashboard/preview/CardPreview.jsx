import { useState, useCallback } from 'react'
import { ZoomIn, ZoomOut, Grid3x3 } from 'lucide-react'
import TemplateRenderer from './TemplateRenderer'
import FullArtRenderer from './FullArtRenderer'

const ZOOM_LEVELS = [50, 75, 100, 150]

export default function CardPreview({ mode, templateData, onDropImage, selectedLayerId, onSelectLayer }) {
    const [zoom, setZoom] = useState(100)
    const [showOutlines, setShowOutlines] = useState(false)
    const [dragOver, setDragOver] = useState(false)

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        if (mode === 'full_art') setDragOver(true)
    }, [mode])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
    }, [])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
        if (mode !== 'full_art') return

        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
        if (files.length > 0 && onDropImage) {
            files.forEach(file => onDropImage(file))
        }
    }, [mode, onDropImage])

    return (
        <div className="flex flex-col items-center gap-3">
            {/* Zoom controls */}
            <div className="flex items-center gap-2">
                <ZoomOut size={14} className="text-gray-500" />
                {ZOOM_LEVELS.map(level => (
                    <button
                        key={level}
                        onClick={() => setZoom(level)}
                        className={`px-2 py-0.5 text-xs rounded transition-colors ${
                            zoom === level
                                ? 'bg-amber-600 text-white'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {level}%
                    </button>
                ))}
                <ZoomIn size={14} className="text-gray-500" />

                {mode === 'full_art' && (
                    <button
                        onClick={() => setShowOutlines(prev => !prev)}
                        className={`ml-3 flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                            showOutlines
                                ? 'bg-amber-600 text-white'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <Grid3x3 size={12} />
                        Outlines
                    </button>
                )}
            </div>

            {/* Card render area with drag-drop */}
            <div
                data-card-preview
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                className={`transition-transform relative ${dragOver ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-900 rounded-xl' : ''}`}
            >
                {mode === 'template' ? (
                    <TemplateRenderer templateData={templateData} />
                ) : (
                    <FullArtRenderer
                        layers={templateData.layers}
                        showOutlines={showOutlines}
                        selectedLayerId={selectedLayerId}
                        onSelectLayer={onSelectLayer}
                    />
                )}

                {/* Drag overlay */}
                {dragOver && (
                    <div className="absolute inset-0 bg-amber-500/10 rounded-xl flex items-center justify-center pointer-events-none z-50">
                        <div className="bg-gray-900/90 px-4 py-2 rounded-lg text-amber-400 text-sm font-medium">
                            Drop to add image layer
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
