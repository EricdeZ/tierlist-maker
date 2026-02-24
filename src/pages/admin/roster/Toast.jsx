// src/pages/admin/roster/Toast.jsx

export function Toast({ toast, onDismiss }) {
    return (
        <div
            className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all animate-[slideIn_0.3s_ease-out] ${
                toast.type === 'success'
                    ? 'bg-green-500/15 border-green-500/30 text-green-400'
                    : 'bg-red-500/15 border-red-500/30 text-red-400'
            }`}
        >
            <div className="flex items-start gap-2">
                <span className="shrink-0">{toast.type === 'success' ? '✓' : '✕'}</span>
                <span>{toast.message}</span>
                <button
                    onClick={onDismiss}
                    className="ml-auto shrink-0 opacity-60 hover:opacity-100"
                >
                    ✕
                </button>
            </div>
        </div>
    )
}
