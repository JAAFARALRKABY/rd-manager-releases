import React, { useState } from "react";
import { AlertTriangle, Trash2, X, Info, Plus } from "lucide-react";

const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "نعم، أوافق",
  cancelText = "إلغاء",
  checkboxText = null,
  type = "danger",
}) => {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 animate-fade-in">
      <div
        className={`bg-slate-900 w-full max-w-md p-0 overflow-hidden rounded-[2rem] border-t-2 ${type === "danger" ? "border-red-500" : "border-blue-500"} shadow-[0_10px_40px_rgba(0,0,0,0.5)] transform scale-100 transition-all`}
      >
        {/* Header Graphic */}
        <div
          className={`${type === "danger" ? "bg-red-500/10" : "bg-blue-500/10"} p-6 flex flex-col items-center justify-center relative overflow-hidden`}
        >
          <div
            className={`absolute top-0 right-0 w-32 h-32 ${type === "danger" ? "bg-red-500/20" : "bg-blue-500/20"} rounded-full blur-3xl`}
          ></div>
          <div
            className={`w-20 h-20 ${type === "danger" ? "bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.4)] border-red-500/30" : "bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.4)] border-blue-500/30"} rounded-full flex items-center justify-center mb-4 relative z-10 border`}
          >
            {type === "danger" ? (
              <AlertTriangle size={40} className="text-red-500 animate-pulse" />
            ) : (
              <Info size={40} className="text-blue-500 animate-pulse" />
            )}
          </div>
          <h3 className="text-2xl font-black text-white relative z-10">
            {title || "تأكيد الإجراء"}
          </h3>
        </div>

        <div className="p-8 text-center">
          <p className="text-slate-300 text-lg font-medium leading-relaxed">
            {message}
          </p>

          {checkboxText && (
            <label className="flex items-center justify-center gap-3 mt-6 cursor-pointer group bg-slate-950/50 p-4 rounded-xl border border-white/5 hover:border-red-500/30 transition-all">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="w-6 h-6 rounded-md border-slate-700 bg-slate-900 text-red-500 focus:ring-red-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span className="text-sm font-bold text-slate-300 group-hover:text-red-400 transition-colors text-right">
                {checkboxText}
              </span>
            </label>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 bg-slate-900/50 border-t border-white/5 flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-slate-700"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm(isChecked);
              setIsChecked(false);
            }}
            className={`flex-1 py-3.5 ${type === "danger" ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]"} text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2`}
          >
            {type === "danger" ? <Trash2 size={18} /> : <Plus size={18} />}{" "}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
