/**
 * BulkWhatsAppModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal for sending bulk WhatsApp messages to selected contacts.
 * All IPC communication and state management stays in DataTableView;
 * this component only renders the UI based on the props it receives.
 */

import React from "react";

const BulkWhatsAppModal = ({
  show,
  onClose,
  selectedCount,
  bulkMessage,
  setBulkMessage,
  bulkProgress,
  waDelay,
  setWaDelay,
  customWaDelay,
  setCustomWaDelay,
  onStart,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  bulkFiles,
  onRemoveBulkFile,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95">
      <div className="bg-slate-900 p-8 rounded-3xl max-w-2xl w-full border-t-2 border-green-500 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <h2 className="text-3xl font-extrabold text-white mb-2">
          إرسال رسالة جماعية (WhatsApp)
        </h2>
        <p className="text-green-400 font-bold mb-6">
          سيتم الإرسال إلى {selectedCount} شخص محدد
        </p>

        <div className="bg-blue-500/10 border border-blue-500/30 p-5 rounded-2xl mb-6 shadow-inner">
          <h4 className="font-extrabold text-blue-400 mb-3 flex items-center gap-2">
            🤖 نظام الإرسال الآلي الذكي (تطبيق الواتساب المكتبي):
          </h4>
          <ul className="text-sm text-slate-300 leading-relaxed space-y-2 list-disc list-inside font-bold mb-4">
            <li>تأكد من أنك <b>مسجل الدخول في تطبيق واتساب المكتبي</b> مسبقاً.</li>
            <li>سيقوم النظام آلياً بالانتظار حتى تحمل المحادثة بناءً على الوقت المحدد.</li>
            <li className="text-green-400">
              سيقوم النظام بنسخ المرفقات ولصقها وإرسالها (Enter) تلقائياً بالنيابة عنك! (لا تتدخل أثناء العملية).
            </li>
          </ul>

          <div className="border-t border-blue-500/20 pt-4 mt-4">
            <p className="text-sm font-bold text-slate-300 mb-3">
              سرعة الإرسال والانتظار (مزامنة تحميل المحادثة الآلي):
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Option: 5 seconds */}
              <label
                className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  waDelay === 5
                    ? "border-indigo-500 bg-indigo-500/10 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                }`}
              >
                <input
                  type="radio"
                  name="wadelay"
                  value={5}
                  checked={waDelay === 5}
                  onChange={() => setWaDelay(5)}
                  className="hidden"
                />
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    waDelay === 5 ? "border-indigo-500" : "border-slate-500"
                  }`}
                >
                  {waDelay === 5 && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                </div>
                <span className="font-bold text-sm">تلقائي (5 ثوانٍ) - موصى به</span>
              </label>

              {/* Option: Custom */}
              <label
                className={`flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  waDelay === "custom"
                    ? "border-amber-500 bg-amber-500/10 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="wadelay"
                    value="custom"
                    checked={waDelay === "custom"}
                    onChange={() => setWaDelay("custom")}
                    className="hidden"
                  />
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      waDelay === "custom" ? "border-amber-500" : "border-slate-500"
                    }`}
                  >
                    {waDelay === "custom" && (
                      <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                    )}
                  </div>
                  <span className="font-bold text-sm">مخصص:</span>
                </div>
                {waDelay === "custom" && (
                  <input
                    type="number"
                    min="1"
                    value={customWaDelay}
                    onChange={(e) => setCustomWaDelay(e.target.value)}
                    placeholder="بالثواني (أقل وقت 1)"
                    className="premium-input !py-1 !px-3 text-sm w-full sm:w-32 bg-slate-900 border-amber-500/50"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </label>
            </div>
          </div>
        </div>

        {/* Drag & drop zone for bulk attachments */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`mb-4 p-4 rounded-2xl border-2 border-dashed transition-colors ${
            isDragging
              ? "border-green-400 bg-green-400/10"
              : "border-slate-700 bg-slate-800/40"
          }`}
        >
          <p className="text-center text-sm font-bold text-slate-400 mb-2">
            اسحب الصور أو المرفقات هنا أو الصقها (اختياري)
          </p>
          {bulkFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {bulkFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 rounded-lg text-xs font-bold text-slate-200 border border-slate-600"
                >
                  <span className="truncate max-w-[100px]">{f.name}</span>
                  <button
                    onClick={() => onRemoveBulkFile(i)}
                    className="text-slate-400 hover:text-red-400 transition-colors ml-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
          اكتب نص الرسالة الموحدة
        </label>
        <textarea
          value={bulkMessage}
          onChange={(e) => setBulkMessage(e.target.value)}
          className="premium-input mb-6 text-lg"
          rows="5"
          placeholder="مرحباً، تفضل بزيارة مشروعنا الجديد..."
          disabled={bulkProgress !== null}
        />

        {bulkProgress && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-center font-bold text-blue-300">{bulkProgress}</p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={onStart}
            disabled={bulkProgress !== null || !bulkMessage.trim()}
            className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-lg disabled:opacity-50"
          >
            بدء الإرسال المتسلسل
          </button>
          <button
            onClick={onClose}
            disabled={bulkProgress !== null}
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkWhatsAppModal;
