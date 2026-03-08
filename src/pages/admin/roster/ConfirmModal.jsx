import BaseModal from '../../../components/BaseModal'

export function ConfirmModal({ confirmModal, onClose }) {
    return (
        <BaseModal onClose={onClose} maxWidth="max-w-sm" className="p-6">
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">{confirmModal.message}</p>
            <div className="flex items-center gap-3 justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={confirmModal.onConfirm}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                        confirmModal.confirmColor === 'red'
                            ? 'bg-red-600 hover:bg-red-500'
                            : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                >
                    {confirmModal.confirmLabel}
                </button>
            </div>
        </BaseModal>
    )
}
