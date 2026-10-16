import React, { useState, useEffect } from "react";
import { MessageSquare, Send, CheckCircle, Clock, Reply, Filter } from "lucide-react";
import { formatBaghdadTime } from "../utils/dateUtils";
import { toast } from "react-hot-toast";
import SingleRecordExport from "./ui/SingleRecordExport";
import ConfirmModal from "./ui/ConfirmModal";

const RequestsView = ({ dbTools, user }) => {
  const { fetchTable, addRecord, updateRecord, deleteRecord, loading } = dbTools;

  const [requests, setRequests]         = useState([]);
  const [users, setUsers]               = useState([]);
  const [departments, setDepartments]   = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [activeTab, setActiveTab]       = useState("all");

  const [isAdding, setIsAdding]         = useState(false);
  const [newReq, setNewReq]             = useState({ title: "", content: "" });
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText]       = useState("");

  const isAdmin   = user.Role === "admin" || user.Role === "assistant";
  const isDeptMgr = user.Role === "department_manager" || user.Role === "manager";

  // ─── Load ───────────────────────────────────────────────────────────────
  const loadData = async () => {
    const [r, u, d, s] = await Promise.all([
      fetchTable("Requests", true),
      fetchTable("Users", false),
      fetchTable("Departments", false),
      fetchTable("SubDepartments", false),
    ]);
    setRequests(r.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)));
    setUsers(u);
    setDepartments(d);
    setSubDepartments(s);
  };

  useEffect(() => { loadData(); }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const parseAllowed = (str) => {
    try {
      if (str === '"all"' || str === "all" || str === '["all"]') return ["all"];
      const p = JSON.parse(str || "[]");
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  };

  const getUserMainDeptIds = (u) => {
    const allowed = parseAllowed(u?.AllowedSubDepartments);
    if (allowed.includes("all")) return ["all"];
    return [...new Set(
      allowed
        .map((id) => subDepartments.find((s) => s.Id.toString() === String(id))?.DepartmentId)
        .filter(Boolean)
    )];
  };

  const myDeptIds = getUserMainDeptIds(user);

  // Get the first dept of the current user (for tagging requests)
  const myFirstDeptId = myDeptIds.includes("all") ? null : (myDeptIds[0] ?? null);

  // ─── Visibility logic ─────────────────────────────────────────────────────
  const canSeeRequest = (req) => {
    if (isAdmin) return true;
    const isOwner = req.CreatedBy_UserId === user.Id;

    if (isDeptMgr) {
      // dept_manager sees own dept's requests OR own requests
      if (isOwner) return true;
      if (myDeptIds.includes("all")) return true;
      return myDeptIds.includes(req.DepartmentId) || myDeptIds.includes(String(req.DepartmentId));
    }

    // supervisor / employee — only own requests
    return isOwner;
  };

  const canManageRequest = (req) => {
    if (isAdmin) return true;
    if (isDeptMgr) {
      if (myDeptIds.includes("all")) return true;
      return myDeptIds.includes(req.DepartmentId) || myDeptIds.includes(String(req.DepartmentId));
    }
    return false;
  };

  // ─── Tab list: only depts that have visible requests ─────────────────────
  const visibleRequests = requests.filter(canSeeRequest);
  
  const deptIdsWithRequests = [...new Set(visibleRequests.map((r) => r.DepartmentId).filter(Boolean))];
  const tabDepts = departments.filter((d) => deptIdsWithRequests.includes(d.Id) || deptIdsWithRequests.includes(String(d.Id)));
  
  const hasNoDeptRequests = visibleRequests.some((r) => !r.DepartmentId);

  const filteredRequests = activeTab === "all"
    ? visibleRequests
    : activeTab === "no_dept"
    ? visibleRequests.filter((r) => !r.DepartmentId)
    : visibleRequests.filter((r) => String(r.DepartmentId) === String(activeTab));

  // ─── Submit new request ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newReq.title || !newReq.content) return;

    await addRecord("Requests", {
      CreatedBy_UserId: user.Id,
      SubDepartmentId: null,
      DepartmentId: myFirstDeptId,
      Title: newReq.title,
      Content: newReq.content,
      Status: "new",
    });

    setNewReq({ title: "", content: "" });
    setIsAdding(false);
    toast.success("تم رفع الطلب الإداري بنجاح");
    loadData();
  };

  const handleStatusChange = async (id, status) => {
    await updateRecord("Requests", id, { Status: status });
    toast.success("تم تغيير حالة الطلب");
    loadData();
  };

  const handleDeleteRequest = (id) => {
    setConfirmConfig({
      title: "تأكيد حذف الطلب",
      message: "هل أنت متأكد من حذف هذا الطلب نهائياً؟",
      confirmText: "حذف",
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteRecord("Requests", id);
        toast.success("تم حذف الطلب بنجاح");
        loadData();
      },
      onCancel: () => setConfirmConfig(null),
    });
  };

  const submitReply = async (req) => {
    if (!replyText) return;
    const updatedContent =
      req.Content +
      `\n\n=== رد الإدارة ===\n${replyText}\n==================\n`;
    await updateRecord("Requests", req.Id, { Content: updatedContent, Status: "completed" });
    toast.success("تم إرسال الرد وإغلاق الطلب");
    setActiveReplyId(null);
    setReplyText("");
    loadData();
  };

  if (loading && requests.length === 0)
    return (
      <div className="text-center p-8 text-slate-400">
        جاري تحميل الطلبات...
      </div>
    );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="text-blue-500" /> مركز الطلبات الإدارية
        </h2>
        {(user.Role === "employee" || user.Role === "supervisor" || isDeptMgr) && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg"
          >
            <Send size={18} /> رفع طلب جديد
          </button>
        )}
      </div>

      {/* ── Department Tabs ─────────────────────────────────────────── */}
      {(isAdmin || isDeptMgr) && (tabDepts.length > 0 || hasNoDeptRequests) && (
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1 no-print"
          style={{ scrollbarWidth: "thin" }}
        >
          <Filter size={16} className="text-slate-500 flex-shrink-0 mr-1" />
          <button
            onClick={() => setActiveTab("all")}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={
              activeTab === "all"
                ? { background: "rgba(59,130,246,0.15)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.3)" }
                : { background: "rgba(255,255,255,0.03)", color: "#64748B", border: "1px solid rgba(255,255,255,0.05)" }
            }
          >
            الكل ({visibleRequests.length})
          </button>

          {hasNoDeptRequests && (
            <button
              onClick={() => setActiveTab("no_dept")}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
              style={
                activeTab === "no_dept"
                  ? { background: "rgba(244,63,94,0.15)", color: "#fb7185", border: "1px solid rgba(244,63,94,0.3)" }
                  : { background: "rgba(255,255,255,0.03)", color: "#64748B", border: "1px solid rgba(255,255,255,0.05)" }
              }
            >
              الإدارة العليا ({visibleRequests.filter((r) => !r.DepartmentId).length})
            </button>
          )}

          {tabDepts.map((dept) => {
            const cnt = visibleRequests.filter((r) => String(r.DepartmentId) === String(dept.Id)).length;
            const active = String(activeTab) === String(dept.Id);
            return (
              <button
                key={dept.Id}
                onClick={() => setActiveTab(dept.Id)}
                className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
                style={
                  active
                    ? { background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }
                    : { background: "rgba(255,255,255,0.03)", color: "#64748B", border: "1px solid rgba(255,255,255,0.05)" }
                }
              >
                {dept.Name} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {/* ── New request form ────────────────────────────────────────── */}
      {isAdding && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4"
        >
          <h3 className="text-xl font-bold text-white mb-4">تفاصيل الطلب الرسمي</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-400 mb-1">عنوان الطلب</label>
              <input
                type="text" required value={newReq.title}
                onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-400 mb-1">محتوى الطلب / التفاصيل</label>
              <textarea
                required rows="4" value={newReq.content}
                onChange={(e) => setNewReq({ ...newReq, content: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <button type="submit" className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg">
              إرسال
            </button>
          </div>
        </form>
      )}

      {/* ── Requests list ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center p-12 bg-slate-900/50 rounded-3xl border border-slate-800">
            <MessageSquare className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">لا توجد طلبات</h3>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const creator = users.find((u) => u.Id === req.CreatedBy_UserId);
            const isOwner = req.CreatedBy_UserId === user.Id;
            const canManage = canManageRequest(req);

            // Dept label
            const creatorDepts = getUserMainDeptIds(creator);
            const depLabel =
              creatorDepts.includes("all")
                ? "الإدارة العليا"
                : creatorDepts
                    .map((id) => departments.find((d) => d.Id === id)?.Name)
                    .filter(Boolean)
                    .join(" و ") || "بدون قسم";

            return (
              <div
                key={req.Id}
                className={`bg-slate-900/80 rounded-2xl p-6 border ${
                  req.Status === "completed"
                    ? "border-green-500/30"
                    : req.Status === "review"
                    ? "border-yellow-500/30"
                    : "border-slate-700"
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-xl text-white">{req.Title}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      المُرسل:{" "}
                      <span className="font-bold text-blue-400">{creator?.Username}</span>{" "}
                      {(isAdmin || isDeptMgr) && (
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-300 mr-2 border border-white/5">
                          {depLabel}
                        </span>
                      )}
                    </p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                      req.Status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : req.Status === "review"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {req.Status === "completed" ? (
                      <><CheckCircle size={14} /> مكتمل</>
                    ) : req.Status === "review" ? (
                      <><Clock size={14} /> قيد المراجعة</>
                    ) : (
                      "جديد"
                    )}
                  </div>
                </div>

                {/* Content */}
                <p className="text-slate-300 text-sm whitespace-pre-wrap bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {req.Content}
                </p>

                {/* Footer */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500">
                      {formatBaghdadTime(req.CreatedAt, true)}
                    </span>
                    <SingleRecordExport
                      record={req}
                      parsedData={{
                        title: req.Title,
                        details: req.Content,
                        status:
                          req.Status === "completed"
                            ? "مكتمل"
                            : req.Status === "review"
                            ? "قيد المراجعة"
                            : "جديد",
                      }}
                      subDepartmentName="الطلبات والدعم"
                      user={user}
                      allUsers={users}
                    />
                  </div>

                  {canManage && (
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleDeleteRequest(req.Id)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors"
                      >
                        حذف
                      </button>
                      {req.Status !== "completed" && (
                        <>
                          <button
                            onClick={() =>
                              setActiveReplyId(activeReplyId === req.Id ? null : req.Id)
                            }
                            className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-bold transition-colors"
                          >
                            كتابة رد وإغلاق
                          </button>
                          {req.Status === "new" && (
                            <button
                              onClick={() => handleStatusChange(req.Id, "review")}
                              className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-bold transition-colors"
                            >
                              قيد المراجعة
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Reply panel */}
                {activeReplyId === req.Id && (
                  <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-blue-500/30 animate-fade-in flex gap-3">
                    <input
                      type="text"
                      placeholder="اكتب الرد الرسمي هنا..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 text-sm"
                    />
                    <button
                      onClick={() => submitReply(req)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors"
                    >
                      إرسال وإنهاء الطلب
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {confirmConfig && (
        <ConfirmModal
          isOpen={true}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmText={confirmConfig.confirmText}
          onConfirm={confirmConfig.onConfirm}
          onCancel={confirmConfig.onCancel}
        />
      )}
    </div>
  );
};

export default RequestsView;
