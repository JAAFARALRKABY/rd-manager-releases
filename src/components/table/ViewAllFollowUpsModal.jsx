/**
 * ViewAllFollowUpsModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen modal that shows ALL follow-up entries for a single client group
 * when the group has more than 3 entries and the user clicks "عرض جميع المتابعات".
 *
 * Props:
 *   modal         — { group, title, phone } | null
 *   onClose       — () => void
 *   onEdit        — (followUpData, recId) => void
 *   onDelete      — (id) => void
 *   user          — current user object
 *   isCallManager — boolean
 *   allSystemUsers — array
 *   subDepartment — current sub-department object
 *   ExportButtons — the ExportButtons component (passed to avoid circular deps)
 */

import React from "react";
import { X, Edit2, Trash2 } from "lucide-react";
import ExportButtons from "../ui/ExportButtons";

const ViewAllFollowUpsModal = ({
  modal,
  onClose,
  onEdit,
  onDelete,
  user,
  isCallManager,
  allSystemUsers,
  subDepartment,
}) => {
  if (!modal) return null;

  const { group, title, phone } = modal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 animate-fade-in">
      <div className="bg-slate-900 rounded-[2rem] max-w-4xl w-full max-h-[90vh] flex flex-col border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-2xl font-extrabold text-white">
            جميع المتابعات - {title} {phone ? `- ${phone}` : ""}
          </h2>
          <div className="flex items-center gap-4">
            <ExportButtons
              elementId={`export-modal-${group.callRecordId}`}
              filename={`متابعات_${title.replace(/\s+/g, "_")}`}
              records={group.followUps.map((f) => ({
                ...f.rec,
                Content: JSON.stringify({
                  ...f.data,
                  callRecordId: `${title} ${phone ? `- ${phone}` : ""}`,
                }),
              }))}
              subName={subDepartment?.Name || "متابعة"}
              user={user}
              allSystemUsers={allSystemUsers}
            />
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Follow-up list */}
        <div className="p-6 overflow-y-auto space-y-4" id={`export-modal-${group.callRecordId}`}>
          {group.followUps.map((f) => (
            <div
              key={f.rec.Id}
              className="bg-slate-800/50 p-5 rounded-2xl border border-white/5 flex flex-col gap-3 relative group/item hover:border-blue-500/30 transition-all"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-xl font-bold text-blue-400">{f.data.followUpType}</span>
                <span className="text-md font-mono text-slate-400">{f.data.followUpDate}</span>
              </div>
              <div className="text-slate-200 text-md leading-relaxed whitespace-pre-wrap">
                {f.data.details}
              </div>

              {/* Edit / Delete buttons (visible on hover) */}
              {(user.Role === "admin" ||
                (user.Role === "employee" && f.rec.CreatedBy_UserId === user.Id) ||
                isCallManager) && (
                <div className="absolute top-3 left-3 flex gap-2 no-print opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(f.data, f.rec.Id)}
                    className="text-slate-500 hover:text-blue-400 p-2 bg-slate-900 rounded-xl hover:bg-white/5"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => onDelete(f.rec.Id)}
                    className="text-slate-500 hover:text-red-400 p-2 bg-slate-900 rounded-xl hover:bg-white/5"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewAllFollowUpsModal;
