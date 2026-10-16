import React, { useState, useEffect, useRef } from "react";
import { Folder, ChevronLeft, Lock, GripVertical, ChevronDown, Building2, Edit2, Check, X, Map } from "lucide-react";
import { toast } from "react-hot-toast";

const REAL_ESTATE_KEY = "rd_realestate_folder_open";
const COMPLEXES_KEY = "rd_complexes_folder_open";

const DepartmentsView = ({ dbTools, user, onSelectSub }) => {
  const { fetchTable, updateRecord, loading } = dbTools;
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  
  const [realEstateOpen, setRealEstateOpen] = useState(
    () => localStorage.getItem(REAL_ESTATE_KEY) !== "false"
  );
  const [complexesOpen, setComplexesOpen] = useState(
    () => localStorage.getItem(COMPLEXES_KEY) !== "false"
  );

  // Drag state (admin only)
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const dragOrder = useRef([]);

  // Edit state (admin only)
  const [editingDepId, setEditingDepId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const isAdmin = user?.Role === "admin" || user?.Role === "assistant";

  const load = async () => {
    const deps = await fetchTable("Departments", false);
    const subs = await fetchTable("SubDepartments", false);
    if (deps.length > 0) {
      setDepartments(sortDeps(deps));
      setSubDepartments(subs);
      setInitialLoad(false);
    }
    const freshDeps = await fetchTable("Departments", true);
    const freshSubs = await fetchTable("SubDepartments", true);
    setDepartments(sortDeps(freshDeps));
    setSubDepartments(freshSubs);
    setInitialLoad(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTable]);

  const sortDeps = (deps) =>
    [...deps].sort((a, b) => {
      const sa = a.SortOrder ?? 9999;
      const sb = b.SortOrder ?? 9999;
      return sa !== sb ? sa - sb : a.Id - b.Id;
    });

  // ─── Access helpers ───────────────────────────────────────────────────────
  let allowedSubs = [];
  try {
    if (
      user.AllowedSubDepartments === '"all"' ||
      user.AllowedSubDepartments === "all" ||
      user.AllowedSubDepartments === '["all"]'
    ) {
      allowedSubs = ["all"];
    } else {
      const parsed = JSON.parse(user.AllowedSubDepartments || "[]");
      if (Array.isArray(parsed)) allowedSubs = parsed;
    }
  } catch (e) {
    allowedSubs = [];
  }

  const hasAccess = (sub, depSubs = null) => {
    if (isAdmin) return true;
    const direct =
      allowedSubs.includes("all") ||
      allowedSubs.includes(sub.Id.toString()) ||
      allowedSubs.includes(sub.Id);
    if (direct) return true;
    if (
      user.CallManagerSubs &&
      (user.CallManagerSubs.includes(sub.Id.toString()) ||
        user.CallManagerSubs.includes(sub.Id))
    )
      return true;
    if (
      sub.Name.includes("مطلوب") &&
      sub.Name.includes("اتصال") &&
      depSubs
    ) {
      const any = depSubs.some(
        (s) =>
          allowedSubs.includes(s.Id.toString()) || allowedSubs.includes(s.Id)
      );
      if (any) return true;
    }
    return false;
  };

  // ─── Edit Department Name (Admin only) ────────────────────────────────────
  const startEditing = (dep) => {
    setEditingDepId(dep.Id);
    setEditingName(dep.Name);
  };

  const cancelEditing = () => {
    setEditingDepId(null);
    setEditingName("");
  };

  const saveEditing = async (id) => {
    if (!editingName.trim()) {
      toast.error("اسم القسم لا يمكن أن يكون فارغاً");
      return;
    }
    try {
      await updateRecord("Departments", id, { Name: editingName.trim() });
      toast.success("تم تعديل اسم القسم بنجاح");
      setEditingDepId(null);
      load(); // Refresh
    } catch (e) {
      toast.error("حدث خطأ أثناء التعديل");
    }
  };

  // ─── Drag & Drop (admin only) ─────────────────────────────────────────────
  const handleDragStart = (e, depId) => {
    setDraggedId(depId);
    dragOrder.current = departments.map((d) => d.Id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, depId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (depId !== draggedId) setDragOverId(depId);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const reordered = [...departments];
    const fromIdx = reordered.findIndex((d) => d.Id === draggedId);
    const toIdx = reordered.findIndex((d) => d.Id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const updated = reordered.map((d, i) => ({ ...d, SortOrder: i }));
    setDepartments(updated);
    setDraggedId(null);
    setDragOverId(null);

    const ipc = window.require ? window.require("electron").ipcRenderer : null;
    if (ipc) {
      const orders = updated.map((d) => ({ id: d.Id, sortOrder: d.SortOrder }));
      ipc
        .invoke("reorder-departments", { orders, userId: user.Id })
        .catch(console.error);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // ─── Toggles ───────────────────────────────────────────────────────────────
  const toggleRealEstate = () => {
    setRealEstateOpen((prev) => {
      localStorage.setItem(REAL_ESTATE_KEY, String(!prev));
      return !prev;
    });
  };

  const toggleComplexes = () => {
    setComplexesOpen((prev) => {
      localStorage.setItem(COMPLEXES_KEY, String(!prev));
      return !prev;
    });
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if ((loading || initialLoad) && departments.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-slate-400 gap-4">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="font-bold tracking-widest animate-pulse">
          جاري تحميل مساحات العمل...
        </p>
      </div>
    );
  }

  // ─── Split deps: real-estate vs complexes vs rest ────────────────────────
  const realEstateDeps = departments.filter((d) => d.Name.trim().startsWith("عقار"));
  const complexesDeps  = departments.filter((d) => d.Name.trim().startsWith("مجمع"));
  const otherDeps      = departments.filter((d) => !d.Name.trim().startsWith("عقار") && !d.Name.trim().startsWith("مجمع"));

  const hasVisibleSubs = (depsList) => {
    return depsList.some((dep) => {
      const depSubs = subDepartments.filter((s) => s.DepartmentId === dep.Id);
      if (depSubs.length === 0) return false;
      const visible = depSubs.filter((s) => hasAccess(s, depSubs));
      if (user.Role === "employee" || user.Role === "supervisor")
        return visible.length > 0;
      return true;
    });
  };

  // Render one dept block (shared)
  const renderDepBlock = (dep, { isDragging = false, isDragOver = false } = {}) => {
    const depSubs    = subDepartments.filter((s) => s.DepartmentId === dep.Id);
    if (depSubs.length === 0) return null;
    const visibleSubs = depSubs.filter((sub) => hasAccess(sub, depSubs));
    if (
      visibleSubs.length === 0 &&
      (user.Role === "employee" || user.Role === "supervisor")
    )
      return null;

    const subsToRender =
      user.Role === "employee" || user.Role === "supervisor"
        ? visibleSubs
        : depSubs;

    return (
      <div
        key={dep.Id}
        className="space-y-6"
        style={{
          opacity: isDragging ? 0.4 : 1,
          outline: isDragOver ? "2px dashed #3B82F6" : "2px dashed transparent",
          borderRadius: "16px",
          transition: "opacity 0.2s, outline 0.15s",
        }}
        onDragOver={isAdmin ? (e) => handleDragOver(e, dep.Id) : undefined}
        onDrop={isAdmin ? (e) => handleDrop(e, dep.Id) : undefined}
      >
        {/* Dept header */}
        <div className="flex items-center gap-4 border-b border-white/5 pb-4 pl-4 group/header">
          {/* Drag handle — admin only */}
          {isAdmin && (
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, dep.Id)}
              onDragEnd={handleDragEnd}
              className="cursor-grab active:cursor-grabbing p-2 rounded-xl hover:bg-white/5 text-slate-600 hover:text-blue-400 transition-colors flex-shrink-0"
              title="اسحب لإعادة الترتيب"
            >
              <GripVertical size={20} />
            </div>
          )}
          <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Folder className="text-blue-400" size={24} />
          </div>

          {editingDepId === dep.Id ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEditing(dep.Id);
                  if (e.key === "Escape") cancelEditing();
                }}
                className="bg-slate-800 text-white font-extrabold text-2xl tracking-wide px-4 py-1 rounded-lg border border-blue-500/50 outline-none w-full max-w-md"
              />
              <button
                onClick={() => saveEditing(dep.Id)}
                className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
                title="حفظ التعديل"
              >
                <Check size={20} />
              </button>
              <button
                onClick={cancelEditing}
                className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                title="إلغاء التعديل"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-extrabold text-white tracking-wide">
                {dep.Name}
              </h2>
              {isAdmin && (
                <button
                  onClick={() => startEditing(dep)}
                  className="p-2 bg-white/5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg opacity-0 group-hover/header:opacity-100 transition-all"
                  title="تعديل اسم القسم"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sub-departments grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 xl:gap-8">
          {subsToRender.map((sub) => {
            const canAccess = hasAccess(sub, depSubs);
            return (
              <div
                key={sub.Id}
                onClick={() => (canAccess ? onSelectSub(sub) : null)}
                className={`glass-panel p-6 relative overflow-hidden transition-all duration-500 ${
                  canAccess
                    ? "cursor-pointer group hover:bg-slate-800/80 hover:border-blue-500/50 hover:shadow-[0_20px_40px_rgba(37,99,235,0.15)] hover:-translate-y-2"
                    : "bg-slate-900/20 border-white/5 opacity-50 cursor-not-allowed grayscale"
                }`}
              >
                <div className="flex flex-col h-full z-10 relative">
                  <div className="flex justify-between items-start mb-6">
                    <div
                      className={`p-3 rounded-2xl ${
                        canAccess
                          ? "bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/20"
                          : "bg-slate-800 border border-white/5"
                      }`}
                    >
                      <Folder
                        className={canAccess ? "text-blue-400" : "text-slate-500"}
                        size={24}
                      />
                    </div>
                    {canAccess ? (
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300 shadow-sm group-hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                        <ChevronLeft
                          size={18}
                          className="group-hover:-translate-x-0.5 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500/50 border border-red-500/20">
                        <Lock size={16} />
                      </div>
                    )}
                  </div>
                  <h3
                    className={`text-xl font-extrabold mt-auto ${
                      canAccess
                        ? "text-white group-hover:text-blue-300"
                        : "text-slate-500"
                    } transition-colors duration-300`}
                  >
                    {sub.Name}
                  </h3>
                </div>
                {canAccess && (
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-fade-in pb-10">
      
      {/* ── Complexes folder (collapsible) ───────────────────────────── */}
      {complexesDeps.length > 0 && hasVisibleSubs(complexesDeps) && (
        <div className="space-y-0">
          <button
            onClick={toggleComplexes}
            className="w-full flex items-center gap-4 border-b border-white/5 pb-4 pl-4 group"
            style={{ background: "transparent", cursor: "pointer" }}
          >
            {isAdmin && (
              <div className="p-2 rounded-xl text-slate-600 flex-shrink-0">
                <GripVertical size={20} className="opacity-0" />
              </div>
            )}
            <div
              className="p-3 rounded-2xl border transition-colors"
              style={{
                background: complexesOpen ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.03)",
                borderColor: complexesOpen ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.05)",
              }}
            >
              <Building2
                size={24}
                className={complexesOpen ? "text-emerald-400" : "text-slate-500"}
              />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-wide flex-1 text-right">
              المجمعات السكنية
              <span className="text-base font-bold mr-3" style={{ color: "#94A3B8" }}>
                ({complexesDeps.length} قسم)
              </span>
            </h2>
            <ChevronDown
              size={24}
              className="text-slate-400 group-hover:text-emerald-400 transition-all duration-300"
              style={{ transform: complexesOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          </button>

          {complexesOpen && (
            <div className="space-y-10 pt-8 pl-4 border-r-2 border-emerald-500/20 mr-4 mt-2">
              {complexesDeps.map((dep) => renderDepBlock(dep, {
                isDragging: draggedId === dep.Id,
                isDragOver: dragOverId === dep.Id,
              }))}
            </div>
          )}
        </div>
      )}

      {/* ── Real Estate folder (collapsible) ─────────────────────────── */}
      {realEstateDeps.length > 0 && hasVisibleSubs(realEstateDeps) && (
        <div className="space-y-0">
          <button
            onClick={toggleRealEstate}
            className="w-full flex items-center gap-4 border-b border-white/5 pb-4 pl-4 group"
            style={{ background: "transparent", cursor: "pointer" }}
          >
            {isAdmin && (
              <div className="p-2 rounded-xl text-slate-600 flex-shrink-0">
                <GripVertical size={20} className="opacity-0" />
              </div>
            )}
            <div
              className="p-3 rounded-2xl border transition-colors"
              style={{
                background: realEstateOpen ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.03)",
                borderColor: realEstateOpen ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.05)",
              }}
            >
              <Map
                size={24}
                className={realEstateOpen ? "text-amber-400" : "text-slate-500"}
              />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-wide flex-1 text-right">
              أقسام العقارات
              <span className="text-base font-bold mr-3" style={{ color: "#94A3B8" }}>
                ({realEstateDeps.length} قسم)
              </span>
            </h2>
            <ChevronDown
              size={24}
              className="text-slate-400 group-hover:text-amber-400 transition-all duration-300"
              style={{ transform: realEstateOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          </button>

          {realEstateOpen && (
            <div className="space-y-10 pt-8 pl-4 border-r-2 border-amber-500/20 mr-4 mt-2">
              {realEstateDeps.map((dep) => renderDepBlock(dep, {
                isDragging: draggedId === dep.Id,
                isDragOver: dragOverId === dep.Id,
              }))}
            </div>
          )}
        </div>
      )}

      {/* ── Regular departments ───────────────────────────────────────── */}
      {otherDeps.map((dep) =>
        renderDepBlock(dep, {
          isDragging: draggedId === dep.Id,
          isDragOver:  dragOverId === dep.Id,
        })
      )}

      {/* Empty state */}
      {departments.length === 0 && !loading && !initialLoad && (
        <div className="text-center p-16 glass-panel rounded-[2rem] max-w-2xl mx-auto mt-10">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
            <Folder className="w-12 h-12 text-slate-500" />
          </div>
          <h3 className="text-2xl font-extrabold text-white mb-3">
            النظام الهيكلي فارغ حالياً
          </h3>
          <p className="text-slate-400 font-bold">
            يرجى من الإدارة العليا تهيئة مساحات العمل والموارد للبدء.
          </p>
        </div>
      )}
    </div>
  );
};

export default DepartmentsView;
