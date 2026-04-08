export default function ConfirmDialog({ isOpen, onConfirm, onCancel, title, message }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-50 border border-surface-200 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="font-display text-lg text-surface-900 mb-2">{title || "Confirm"}</h3>
        <p className="font-body text-sm text-surface-600 mb-5">{message || "Are you sure?"}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 font-body text-xs text-surface-500 hover:text-surface-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-950 border border-red-800 font-display font-bold text-xs text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
