import React, { useState, useEffect } from "react";
import {
  Activity,
  Clock,
  LogIn,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  Download,
  UploadCloud,
  RefreshCw,
} from "lucide-react";
import { formatBaghdadTime } from "../utils/dateUtils";
import ExportButtons from "./ui/ExportButtons";
import ConfirmModal from "./ui/ConfirmModal";
import { getIpcRenderer } from "../utils/ipc";

// Static maps — defined outside component to avoid re-creation on every render
const ACTION_ICONS = {
  login:   <LogIn className="text-green-500" size={16} />,
  logout:  <LogOut className="text-slate-500" size={16} />,
  add:     <Plus className="text-blue-500" size={16} />,
  edit:    <Edit2 className="text-yellow-500" size={16} />,
  delete:  <Trash2 className="text-red-500" size={16} />,
  export:  <Download className="text-indigo-500" size={16} />,
  upload:  <UploadCloud className="text-teal-500" size={16} />,
  restore: <RefreshCw className="text-green-400" size={16} />,
};

const ACTION_LABELS = {
  login:   "تسجيل دخول",
  logout:  "تسجيل خروج",
  add:     "إضافة سجل",
  edit:    "تعديل سجل",
  delete:  "حذف سجل",
  export:  "تصدير بيانات",
  upload:  "رفع ملف",
  restore: "استعادة ملف",
};

const getActionIcon  = (action) => ACTION_ICONS[action]  ?? <Activity className="text-slate-400" size={16} />;
const getActionLabel = (action) => ACTION_LABELS[action] ?? action;

const ActivityLogView = ({ dbTools, user }) => {
  const { fetchTable, loading } = dbTools;
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState(null);

  useEffect(() => {
    const load = async () => {
      const u = await fetchTable("Users", false);
      setUsers(u);
      const subs = await fetchTable("SubDepartments", false);
      setSubDepartments(subs);
      const l = await fetchTable("ActivityLogs", true);
      setLogs(l.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)));
    };
    load();
  }, [fetchTable]);

  const handleClearLogs = () => {
    setConfirmConfig({
      title: "مسح سجل التدقيق",
      message:
        "تحذير: هل أنت متأكد من مسح جميع سجلات التدقيق المؤسسي نهائياً؟ لا يمكن التراجع عن هذه الخطوة.",
      confirmText: "نعم، امسح السجل",
      onConfirm: async () => {
        setConfirmConfig(null);
        const ipcRenderer = getIpcRenderer();
        const res = await ipcRenderer.invoke("clear-logs", { userId: user?.Id });
        if (res.success) {
          const l = await fetchTable("ActivityLogs", true);
          setLogs(l);
        }
      },
      onCancel: () => setConfirmConfig(null),
    });
  };

  if (loading && logs.length === 0)
    return (
      <div className="text-center p-8 text-slate-400">جاري تحميل السجل...</div>
    );

  return (
    <div className="space-y-6 animate-fade-in" id="export-section">
      <div className="flex justify-between items-center mb-6 no-print">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="text-blue-500" /> سجل التدقيق المؤسسي
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearLogs}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-bold flex items-center gap-2 transition-colors"
          >
            <Trash2 size={16} /> تنظيف السجل
          </button>
          <ExportButtons elementId="export-section" filename="سجل_التدقيق" />
        </div>
      </div>

      <div className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <th className="p-4">المستخدم</th>
              <th className="p-4">النشاط المسجل</th>
              <th className="p-4">وحدة التخزين (الجدول)</th>
              <th className="p-4">البيانات الفنية</th>
              <th className="p-4">الطابع الزمني</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-500">
                  سجل التدقيق فارغ
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const u = users.find((x) => x.Id === log.UserId);
                let details = "";
                try {
                  details = log.Details ? JSON.parse(log.Details) : null;
                } catch (e) {}

                return (
                  <tr
                    key={log.Id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="p-4 font-bold text-white">
                      {u ? u.Username : "مستخدم مجهول"}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.Action)}
                        <span className="font-bold text-slate-300">
                          {getActionLabel(log.Action)}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-xs">
                      {log.TargetTable || "-"}{" "}
                      {log.TargetId ? `#${log.TargetId}` : ""}
                    </td>
                    <td
                      className="p-4 text-slate-300 font-bold max-w-[200px] truncate"
                      title={log.Details || "-"}
                    >
                      {(() => {
                        if (!details) return "-";

                        let subNameText = "";
                        if (
                          details.SubDepartmentId &&
                          subDepartments.length > 0
                        ) {
                          const sub = subDepartments.find(
                            (s) => s.Id === details.SubDepartmentId,
                          );
                          if (sub) {
                            subNameText = `(القسم: ${sub.Name}) - `;
                          }
                        }

                        return (
                          <span>
                            <span className="text-blue-400">{subNameText}</span>
                            {JSON.stringify(details).substring(0, 50) + "..."}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-4 text-slate-500 text-xs flex items-center gap-1 dir-ltr justify-end">
                      <Clock size={12} />{" "}
                      {formatBaghdadTime(log.CreatedAt, true)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal {...(confirmConfig || {})} isOpen={!!confirmConfig} />
    </div>
  );
};

export default ActivityLogView;
