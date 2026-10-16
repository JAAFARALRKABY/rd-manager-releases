import React, { useState, useEffect, useRef } from "react";
import {
  X,
  UploadCloud,
  Image as ImageIcon,
  Video,
  Trash2,
  CheckCircle2,
  FileText,
} from "lucide-react";

const AttachmentsModal = ({
  isOpen,
  onClose,
  attachedFiles,
  onRemoveFile,
  onFilesDrop,
  uploading,
  existingFiles = [],
  onRemoveExistingFile = null,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [isProcessingClose, setIsProcessingClose] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setPendingDeletions([]);
      return;
    }

    const handleGlobalPaste = (e) => {
      if (
        e.clipboardData &&
        e.clipboardData.files &&
        e.clipboardData.files.length > 0
      ) {
        const file = e.clipboardData.files[0];
        const fileType = file.type || "";
        if (
          fileType.startsWith("image/") ||
          fileType.startsWith("video/") ||
          file.name.match(/\.(jpg|jpeg|png|gif|mp4|webm|mkv)$/i)
        ) {
          onFilesDrop(e);
        }
      }
    };
    const uniqueId = `file-upload-${Math.random().toString(36).substr(2, 9)}`;

    document.addEventListener("paste", handleGlobalPaste);
    return () => document.removeEventListener("paste", handleGlobalPaste);
  }, [isOpen, onFilesDrop]);

  const handleConfirmAndClose = async () => {
    if (pendingDeletions.length > 0 && onRemoveExistingFile) {
      setIsProcessingClose(true);
      for (const id of pendingDeletions) {
        await onRemoveExistingFile(id);
      }
      setPendingDeletions([]);
      setIsProcessingClose(false);
    }
    onClose();
  };

  if (!isOpen) return null;

  const visibleExistingFiles = existingFiles.filter(f => !pendingDeletions.includes(f.Id));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleConfirmAndClose}
      ></div>

      <div className="relative bg-[#18181b] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-scale-up overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg">
              <UploadCloud size={20} className="text-white" />
            </div>
            إدارة المرفقات (صور وفيديو)
          </h3>
          <button
            onClick={handleConfirmAndClose}
            className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Drop Zone */}
          <div
            ref={dropRef}
            className={`w-full border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden focus:outline-none ${isDragging ? "border-purple-500 bg-purple-500/10 scale-[1.02]" : "border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-800"}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              onFilesDrop(e);
            }}
            onClick={(e) => {
              if (e.target.tagName !== "INPUT") {
                const inputEl =
                  e.currentTarget.querySelector('input[type="file"]');
                if (inputEl) inputEl.click();
              }
            }}
          >
            {uploading && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                  <span className="text-white font-bold animate-pulse">
                    جاري المعالجة والرفع...
                  </span>
                </div>
              </div>
            )}

            <div
              className={`p-5 rounded-full bg-slate-800/80 border border-white/5 mb-4 text-slate-300 transition-transform ${isDragging ? "scale-125 text-purple-400" : "group-hover:scale-110"}`}
            >
              <UploadCloud size={40} />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">
              اسحب وأفلت المرفقات هنا
            </h4>
            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
              أو انقر لاختيار الملفات من جهازك. يدعم سحب الصور من جوجل مباشرة،
              ويمكنك الضغط على{" "}
              <kbd className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-xs text-slate-300 mx-1">
                Ctrl+V
              </kbd>{" "}
              للصق.
            </p>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={onFilesDrop}
              disabled={uploading}
            />
          </div>

          {/* Gallery */}
          {(attachedFiles.length > 0 || visibleExistingFiles.length > 0) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-300 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-500" />
                  المرفقات الحالية ({attachedFiles.length + visibleExistingFiles.length})
                </h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {/* Render Existing Files First */}
                {visibleExistingFiles.map((f) => {
                  const isVideo = f.FileType && f.FileType.startsWith("video");
                  return (
                    <div
                      key={f.Id}
                      className="group relative bg-slate-800 rounded-2xl border border-white/10 overflow-hidden aspect-square flex flex-col items-center justify-center text-center p-4 hover:border-red-500/50 transition-all"
                    >
                      {isVideo ? (
                        <Video size={32} className="text-blue-400 mb-3" />
                      ) : (
                        <ImageIcon size={32} className="text-purple-400 mb-3" />
                      )}
                      <span
                        className="text-xs text-slate-300 font-bold truncate w-full px-2"
                        dir="ltr"
                        title={f.FilePath}
                      >
                        {f.FilePath.split("\\").pop().split("_").slice(1).join("_")}
                      </span>
                      <div className="absolute top-2 right-2 px-2 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-lg border border-blue-500/30">
                        مرفوع مسبقاً
                      </div>

                      {/* Overlay Actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeletions(prev => [...prev, f.Id]);
                          }}
                          className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 border border-red-500/50 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors transform scale-75 group-hover:scale-100"
                          title="حذف الملف"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {/* Render New Files */}
                {attachedFiles.map((f, i) => {
                  const isVideo = f.type && f.type.startsWith("video");
                  return (
                    <div
                      key={f.id || i}
                      className="group relative bg-slate-800 rounded-2xl border border-white/10 overflow-hidden aspect-square flex flex-col items-center justify-center text-center p-4 hover:border-purple-500/50 transition-all"
                    >
                      {isVideo ? (
                        <Video size={32} className="text-blue-400 mb-3" />
                      ) : (
                        <ImageIcon size={32} className="text-purple-400 mb-3" />
                      )}
                      <span
                        className="text-xs text-slate-300 font-bold truncate w-full px-2"
                        dir="ltr"
                        title={f.name}
                      >
                        {f.name}
                      </span>

                      {/* Overlay Actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFile(f.id || i);
                          }}
                          className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 border border-red-500/50 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors transform scale-75 group-hover:scale-100"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {attachedFiles.length === 0 && visibleExistingFiles.length === 0 && (
            <div className="text-center text-slate-500 font-bold py-4">
              لا توجد مرفقات حالياً
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end">
          <button
            onClick={handleConfirmAndClose}
            disabled={isProcessingClose}
            className="px-8 py-3 bg-gradient-to-r flex items-center gap-2 from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isProcessingClose ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                جاري التحديث...
              </>
            ) : (
              "تأكيد وإغلاق"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttachmentsModal;
