import { useState, useRef, useCallback } from 'react'
import { Upload, Image as ImageIcon } from 'lucide-react'
import LayerStackPanel from './LayerStackPanel'
import LayerProperties from './LayerProperties'

let nextLayerId = 1

function generateLayerName(type, layers) {
    const count = layers.filter(l => l.type === type).length
    const names = {
        image: count === 0 ? 'Background' : count === 1 ? 'Character' : `Image ${count + 1}`,
        effect: count === 0 ? 'Holo Effect' : `Effect ${count + 1}`,
        frame: count === 0 ? 'Card Frame' : `Frame ${count + 1}`,
        text: count === 0 ? 'Title' : count === 1 ? 'Subtitle' : `Text ${count + 1}`,
    }
    return names[type] || `Layer ${count + 1}`
}

export default function FullArtModeControls({ layers, onLayersChange, onUploadImage }) {
    const [selectedLayerId, setSelectedLayerId] = useState(null)
    const [dropActive, setDropActive] = useState(false)
    const fileInputRef = useRef(null)

    const selectedLayer = layers.find(l => l.id === selectedLayerId) || null

    const addImageFromFile = useCallback((file) => {
        const objectUrl = URL.createObjectURL(file)
        const name = generateLayerName('image', layers)
        const layer = {
            id: `image-${nextLayerId++}`,
            type: 'image',
            name,
            url: objectUrl,
            _pendingFile: file, // marker for pending upload
            position: { x: 0, y: 0 },
            size: { w: '100%', h: '100%' },
            z: layers.length,
            opacity: 1,
            blendMode: 'normal',
            visible: true,
        }
        const next = [...layers, layer]
        onLayersChange(next)
        setSelectedLayerId(layer.id)

        // Trigger upload in parent
        if (onUploadImage) {
            onUploadImage(file, layer.id)
        }
    }, [layers, onLayersChange, onUploadImage])

    function addLayer(type) {
        const name = generateLayerName(type, layers)
        const defaults = {
            image: { url: '', position: { x: 0, y: 0 }, size: { w: '100%', h: '100%' } },
            effect: { effectName: 'rainbow', opacity: 0.6, blendMode: 'overlay' },
            frame: { frameStyle: 'full_art_gold' },
            text: { content: 'Text', font: 'Cinzel', fontSize: 24, color: '#ffffff', position: { x: 50, y: 15 }, shadow: true, stroke: null },
        }
        const layer = {
            id: `${type}-${nextLayerId++}`,
            type,
            name,
            ...defaults[type],
            z: layers.length,
            opacity: defaults[type]?.opacity ?? 1,
            blendMode: defaults[type]?.blendMode ?? 'normal',
            visible: true,
        }
        onLayersChange([...layers, layer])
        setSelectedLayerId(layer.id)
    }

    function updateLayer(id, updates) {
        onLayersChange(layers.map(l => l.id === id ? { ...l, ...updates } : l))
    }

    function deleteLayer(id) {
        onLayersChange(layers.filter(l => l.id !== id))
        if (selectedLayerId === id) setSelectedLayerId(null)
    }

    function reorderLayers(reordered) {
        onLayersChange(reordered.map((l, i) => ({ ...l, z: i })))
    }

    function toggleVisibility(id) {
        onLayersChange(layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l))
    }

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setDropActive(false)
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
        files.forEach(f => addImageFromFile(f))
    }, [addImageFromFile])

    const handleFileSelect = useCallback((e) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'))
        files.forEach(f => addImageFromFile(f))
        e.target.value = '' // reset so same file can be re-selected
    }, [addImageFromFile])

    return (
        <div className="space-y-4">
            {/* Drop zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDropActive(true) }}
                onDragLeave={() => setDropActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    dropActive
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30'
                }`}
            >
                <div className="flex flex-col items-center gap-2">
                    {dropActive ? (
                        <ImageIcon size={28} className="text-amber-400" />
                    ) : (
                        <Upload size={28} className="text-gray-500" />
                    )}
                    <p className={`text-sm font-medium ${dropActive ? 'text-amber-400' : 'text-gray-400'}`}>
                        {dropActive ? 'Drop to add layer' : 'Drop images or click to browse'}
                    </p>
                    <p className="text-xs text-gray-600">PNG, JPG, WebP up to 2MB</p>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                />
            </div>

            {/* Layer stack */}
            <LayerStackPanel
                layers={layers}
                selectedLayerId={selectedLayerId}
                onSelect={setSelectedLayerId}
                onAdd={addLayer}
                onDelete={deleteLayer}
                onReorder={reorderLayers}
                onToggleVisibility={toggleVisibility}
            />

            {/* Properties for selected layer */}
            {selectedLayer && (
                <LayerProperties
                    layer={selectedLayer}
                    onUpdate={updates => updateLayer(selectedLayer.id, updates)}
                    onUploadImage={onUploadImage}
                />
            )}
        </div>
    )
}
