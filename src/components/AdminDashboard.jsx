import React, { useState, useEffect, useMemo } from "react";
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Key,
  Users,
  Copy,
  CheckCircle2,
  Search,
  Filter,
  MonitorPlay,
  Save,
  Folder,
  FolderPlus,
  ShieldCheck,
  CheckSquare,
  Settings,
  BarChart2,
  Download,
  ShieldAlert,
  Database,
} from "lucide-react";
import { formatBaghdadTime } from "../utils/dateUtils";
import toast from "react-hot-toast";
import AnalyticsDashboard from "./AnalyticsDashboard";
import ConfirmModal from "./ui/ConfirmModal";
import { getIpcRenderer } from "../utils/ipc";

const AdminDashboard = ({ dbTools, user, isGloballyLocked, setIsGloballyLocked }) => {
  const {
    fetchTable,
    addRecord,
    deleteRecord,
    restoreFile,
    deleteFilePermanent,
    loading,
  } = dbTools;
  const [activeTab, setActiveTab] = useState("analytics");


  const [usersList, setUsersList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [inactiveUsers, setInactiveUsers] = useState([]);
  const [callManagers, setCallManagers] = useState({});
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [changePasswordUser, setChangePasswordUser] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [newFullNameValue, setNewFullNameValue] = useState("");
  const [editDepartmentsUser, setEditDepartmentsUser] = useState(null);
  const [selectedEditDeps, setSelectedEditDeps] = useState([]);
  const [editCallManagerUser, setEditCallManagerUser] = useState(null);
  const [selectedCallManagerDeps, setSelectedCallManagerDeps] = useState([]);
  const [newUsernameValue, setNewUsernameValue] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [newUser, setNewUser] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "employee",
    allowedSubs: [],
  });
  const [submittingUser, setSubmittingUser] = useState(false);
  const [newDep, setNewDep] = useState("");
  const [newSub, setNewSub] = useState({
    depIds: [],
    names: [],
    customName: "",
  });

  const loadData = async () => {
    const u = await fetchTable("Users", true);
    const d = await fetchTable("Departments", true);
    const s = await fetchTable("SubDepartments", true);
    const cats = await fetchTable("CustomCategories", true);

    const ipcRenderer = window.require("electron").ipcRenderer;
    const inactiveRes = await ipcRenderer.invoke("get-inactive-users", { userId: user?.Id });
    if (inactiveRes.success) setInactiveUsers(inactiveRes.data || []);

    const callMgrRes = await ipcRenderer.invoke("get-call-managers");
    if (callMgrRes.success) setCallManagers(callMgrRes.data || {});

    setUsersList(u);
    setDepartments(d);
    setSubDepartments(s);
    setCustomCategories(cats || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveUserDepartments = async (e) => {
    e.preventDefault();
    try {
      const ipcRenderer = window.require("electron").ipcRenderer;
      await ipcRenderer.invoke("update-record", {
        table: "Users",
        id: editDepartmentsUser.id,
        data: {
          AllowedSubDepartments: JSON.stringify(selectedEditDeps.map(String)),
          Role: editDepartmentsUser.role,
        },
      });
      toast.success("تم تحديث بيانات الموظف بنجاح");
      setEditDepartmentsUser(null);
      loadData();
    } catch (err) {
      toast.error("حدث خطأ أثناء حفظ الصلاحيات");
    }
  };

  const handleSaveCallManagers = async (e) => {
    e.preventDefault();
    try {
      const ipcRenderer = window.require("electron").ipcRenderer;
      const res = await ipcRenderer.invoke("save-call-managers", {
        userId: editCallManagerUser.id,
        subDepartmentIds: selectedCallManagerDeps.map(Number),
        adminId: user.Id,
      });
      if (res.success) {
        toast.success("تم تحديث صلاحيات الاتصالات للموظف بنجاح");
        setEditCallManagerUser(null);
        loadData();
      } else {
        toast.error(res.error || "خطأ غير معروف");
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء حفظ المهام");
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || submittingUser) return;

    setSubmittingUser(true);
    const ipcRenderer = window.require("electron").ipcRenderer;
    const result = await ipcRenderer.invoke("add-user", {
      adminId: user.Id,
      user: {
        fullName: newUser.fullName,
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        allowedSubDepartments:
          newUser.role === "admin" ? ["all"] : newUser.allowedSubs,
      },
    });

    if (result.success) {
      setNewUser({
        fullName: "",
        username: "",
        password: "",
        role: "employee",
        allowedSubs: [],
      });
      toast.success("تم إنشاء حساب المستخدم بنجاح");
      loadData();
    } else {
      toast.error(result.error);
    }
    setSubmittingUser(false);
  };

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!newDep) return;
    await addRecord("Departments", { Name: newDep });
    setNewDep("");
    toast.success("تمت إضافة الإدارة بنجاح");
    loadData();
  };

  const handleAddSubDepartment = async (e) => {
    e.preventDefault();
    
    if (!newSub.depIds || newSub.depIds.length === 0 || !newSub.names || newSub.names.length === 0) return;
    
    const hasCustom = newSub.names.includes("مخصص");
    if (hasCustom && !newSub.customName) return;
    
    for (const depId of newSub.depIds) {
      for (const rawName of newSub.names) {
        const finalName = rawName === "مخصص" ? newSub.customName : rawName;
        if (!finalName) continue;
        await addRecord("SubDepartments", {
          DepartmentId: depId,
          Name: finalName,
        });
      }
    }
    
    setNewSub({ depIds: [], names: [], customName: "" });
    toast.success("تم إنشاء الأقسام الفرعية بنجاح");
    loadData();
  };

  const toggleSubSelection = (subId) => {
    const current = [...newUser.allowedSubs];
    if (current.includes(subId.toString())) {
      setNewUser({
        ...newUser,
        allowedSubs: current.filter((id) => id !== subId.toString()),
      });
    } else {
      setNewUser({ ...newUser, allowedSubs: [...current, subId.toString()] });
    }
  };

  const toggleDepartmentSelection = (depId) => {
    const subsInDep = subDepartments
      .filter((s) => s.DepartmentId === depId)
      .map((s) => s.Id.toString());
    const current = [...newUser.allowedSubs];
    const allSelected = subsInDep.every((id) => current.includes(id));

    if (allSelected) {
      setNewUser({
        ...newUser,
        allowedSubs: current.filter((id) => !subsInDep.includes(id)),
      });
    } else {
      const newAllowed = [...new Set([...current, ...subsInDep])];
      setNewUser({ ...newUser, allowedSubs: newAllowed });
    }
  };

  const handleDeleteUser = (id, role, username) => {
    if (role === "admin" && user.Username !== "T8#vQ2!mL9@rPx7") {
      toast.error("لا تملك الصلاحية لحذف مدراء النظام");
      return;
    }
    if (username === "T8#vQ2!mL9@rPx7") {
      toast.error("لا يمكن حذف حساب المؤسس الأساسي");
      return;
    }
    setConfirmConfig({
      title: "حذف مستخدم",
      message: "هل أنت متأكد من تعطيل/حذف هذا المستخدم نهائياً؟",
      confirmText: "تأكيد الحذف",
      checkboxText:
        "حذف جميع السجلات والبيانات التي أدخلها هذا الموظف أيضاً بشكل نهائي",
      onConfirm: async (deleteRecords) => {
        setConfirmConfig(null);
        const ipcRenderer = window.require("electron").ipcRenderer;
        const result = await ipcRenderer.invoke("delete-user-advanced", {
          targetUserId: id,
          deleteRecords: deleteRecords,
          adminId: user.Id,
        });

        if (result.success) {
          toast.success(
            deleteRecords
              ? "تم حذف المستخدم وجميع بياناته بنجاح"
              : "تم تعطيل المستخدم بنجاح",
          );
          loadData();
        } else {
          toast.error("حدث خطأ أثناء الحذف: " + result.error);
        }
      },
      onCancel: () => setConfirmConfig(null),
    });
  };

  const handleDeleteDepartment = (id) => {
    setConfirmConfig({
      title: "حذف قسم رئيسي",
      message:
        "هل أنت متأكد من حذف هذا القسم نهائياً؟ سيتم حذف جميع الأقسام الفرعية التابعة له.",
      confirmText: "حذف",
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteRecord("Departments", id);
        toast.success("تم حذف القسم بنجاح");
        loadData();
      },
      onCancel: () => setConfirmConfig(null),
    });
  };

  const handleDeleteSubDepartment = (id) => {
    setConfirmConfig({
      title: "حذف نافذة عمل",
      message:
        "هل أنت متأكد من حذف نافذة العمل هذه نهائياً؟ سيتم حذف جميع السجلات والمرفقات التابعة لها.",
      confirmText: "حذف",
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteRecord("SubDepartments", id);
        toast.success("تم حذف نافذة العمل بنجاح");
        loadData();
      },
      onCancel: () => setConfirmConfig(null),
    });
  };

  const handleDeleteCustomCategory = (id) => {
    setConfirmConfig({
      title: "حذف تصنيف مخصص",
      message:
        "هل أنت متأكد من حذف هذا التصنيف المخصص؟ لن يظهر مجدداً في خيارات التصنيف عند إضافة العملاء.",
      confirmText: "حذف",
      onConfirm: async () => {
        setConfirmConfig(null);
        await deleteRecord("CustomCategories", id);
        toast.success("تم حذف التصنيف بنجاح");
        loadData();
      },
      onCancel: () => setConfirmConfig(null),
    });
  };

  const handleRestoreFile = async (id) => {
    const result = await restoreFile(id);
    if (result.success) {
      toast.success("تم استعادة الملف بنجاح");
      loadData();
    } else {
      toast.error("حدث خطأ أثناء الاستعادة");
    }
  };

  const handlePermanentDeleteFile = (id) => {
    setConfirmConfig({
      title: "حذف ملف نهائياً",
      message:
        "هل أنت متأكد من حذف هذا الملف نهائياً من القرص الصلب؟ لا يمكن استرجاعه بعد ذلك.",
      confirmText: "حذف نهائي",
      onConfirm: async () => {
        setConfirmConfig(null);
        const result = await deleteFilePermanent(id);
        if (result.success) {
          toast.success("تم حذف الملف نهائياً");
          loadData();
        } else {
          toast.error("حدث خطأ أثناء الحذف: " + result.error);
        }
      },
      onCancel: () => setConfirmConfig(null),
    });
  };

  const handleClearLogs = async () => {
    if (
      window.confirm("هل أنت متأكد من مسح جميع السجلات؟ لا يمكن استرجاعها.")
    ) {
      const ipcRenderer = window.require("electron").ipcRenderer;
      const res = await ipcRenderer.invoke("clear-logs");
      if (res.success) toast.success("تم مسح السجلات بنجاح");
      else toast.error("خطأ: " + res.error);
    }
  };

  const handleEmptyTrash = () => {
    setConfirmConfig({
      title: "تفريغ سلة المهملات",
      message: "هل أنت متأكد من حذف جميع الملفات الموجودة في سلة المهملات بشكل نهائي من القرص الصلب؟ (لا يمكن التراجع عن هذا الإجراء)",
      confirmText: "نعم، تفريغ المهملات",
      type: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        const toastId = toast.loading("جاري تفريغ المهملات وحذف الملفات...");
        const ipcRenderer = window.require("electron").ipcRenderer;
        const res = await ipcRenderer.invoke("empty-trash", { userId: user.Id });
        if (res.success) {
          toast.success(`تم تفريغ سلة المهملات بنجاح. تم حذف ${res.count || 0} ملف.`, { id: toastId });
          loadData();
        } else {
          toast.error("حدث خطأ أثناء التفريغ: " + res.error, { id: toastId });
        }
      },
      onCancel: () => setConfirmConfig(null),
    });
  };

  const handleBackup = async () => {
    const ipcRenderer = window.require("electron").ipcRenderer;
    const toastId = toast.loading("جاري سحب الداتا وبناء النسخة الاحتياطية...");
    try {
      const res = await ipcRenderer.invoke("take-backup", { userId: user.Id });
      if (res.success) {
        toast.success("تم أخذ النسخة الاحتياطية بنجاح!", { id: toastId });
      } else {
        toast.error("فشل النسخ الاحتياطي: " + res.error, { id: toastId });
      }
    } catch (e) {
      toast.error("حدث خطأ أثناء النسخ", { id: toastId });
    }
  };

  const openBackupFolder = async () => {
    const ipcRenderer = getIpcRenderer();
    await ipcRenderer.invoke("open-backup-folder");
  };

  const handleToggleLock = async () => {
    setConfirmConfig({
      title: isGloballyLocked ? "فتح النظام" : "إغلاق النظام",
      message: isGloballyLocked 
        ? "هل أنت متأكد من رغبتك في فتح النظام للسماح لجميع الموظفين بالدخول مجدداً؟" 
        : "هل أنت متأكد من رغبتك في إغلاق النظام عن الجميع؟ لن يتمكن أحد باستثنائك من استخدام النظام وسيتم طردهم فوراً.",
      onConfirm: async () => {
        const ipcRenderer = getIpcRenderer();
        const res = await ipcRenderer.invoke("toggle-app-lock", !isGloballyLocked);
        if (res.success) {
          setIsGloballyLocked(!isGloballyLocked); // Update immediately
          toast.success(isGloballyLocked ? "تم فتح النظام بنجاح" : "تم إغلاق النظام بنجاح!");
        } else {
          toast.error("حدث خطأ أثناء تغيير حالة النظام: " + res.error);
        }
        setConfirmConfig(null);
      }
    });
  };

  const filteredUsersList = useMemo(() => {
    const myAllowedSubs = [];
    try {
      if (user.AllowedSubDepartments === '"all"' || user.AllowedSubDepartments === "all" || user.AllowedSubDepartments === '["all"]') {
        myAllowedSubs.push("all");
      } else {
        const parsed = JSON.parse(user.AllowedSubDepartments || "[]");
        if (Array.isArray(parsed)) myAllowedSubs.push(...parsed);
      }
    } catch(e){}
    
    const myMainDeps = new Set();
    if (myAllowedSubs.includes("all") || user.Role === "admin" || user.Role === "assistant") {
      myMainDeps.add("all");
    } else {
      subDepartments.forEach(sub => myMainDeps.add(sub.DepartmentId));
    }

    return usersList
      .filter(
        (u) =>
          u.Role !== "admin" ||
          user.Username === "T8#vQ2!mL9@rPx7",
      )
      .filter((u) => {
        // Prevent department_manager from seeing themselves in the list
        if (user.Role === "department_manager" && u.Id === user.Id) return false;

        if (user.Role === "admin" || user.Role === "assistant") return true;
        
        let uAllowed = [];
        try {
          if (u.AllowedSubDepartments === '"all"' || u.AllowedSubDepartments === "all" || u.AllowedSubDepartments === '["all"]') {
            uAllowed = ["all"];
          } else {
            const parsed = JSON.parse(u.AllowedSubDepartments || "[]");
            if (Array.isArray(parsed)) uAllowed = parsed;
          }
        } catch(e){}
        
        if (uAllowed.includes("all") || myMainDeps.has("all")) return true;
        
        // Direct overlap: if the user shares ANY sub-department with the manager, show them.
        // This is much safer than relying on the fetched subDepartments array mapping.
        const overlap = uAllowed.some(id => myAllowedSubs.includes(String(id)));
        if (overlap) return true;
        
        // Fallback to DepartmentId mapping just in case
        const uMainDeps = new Set();
        uAllowed.forEach(id => {
          const sub = subDepartments.find(s => s.Id.toString() === String(id));
          if (sub) uMainDeps.add(sub.DepartmentId);
        });
        
        for (let d of uMainDeps) {
          if (myMainDeps.has(d)) return true;
        }
        
        return false;
      });
  }, [usersList, user, subDepartments]);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Tabs & Master Lock */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap gap-4">
        {user.Role === "admin" && (
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 ${
              activeTab === "analytics"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 scale-105"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <BarChart2 size={22} /> إحصائيات الأداء والمؤشرات
          </button>
        )}
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 ${
            activeTab === "users"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 scale-105"
              : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Users size={22} /> صلاحيات الوصول والمستخدمين
        </button>
        {user.Role === "admin" && (
          <>
            <button
              onClick={() => setActiveTab("departments")}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 ${
                activeTab === "departments"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 scale-105"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Settings size={22} /> الهيكل الإداري للمؤسسة
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 ${
                activeTab === "categories"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/40 scale-105"
                  : "bg-white/5 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400"
              }`}
            >
              <Database size={22} /> التصنيفات المخصصة
            </button>
          </>
        )}
        </div>

        {/* Global Lock Button (Admin only) */}
        {user.Role === "admin" && user.Username === "T8#vQ2!mL9@rPx7" && (
          <button
            onClick={handleToggleLock}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all duration-300 shadow-lg ${
              isGloballyLocked
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-900/40 hover:scale-105 animate-pulse"
                : "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-900/40 hover:scale-105"
            }`}
          >
            {isGloballyLocked ? (
              <>
                <ShieldCheck size={22} />
                فتح النظام الآن
              </>
            ) : (
              <>
                <ShieldAlert size={22} />
                إغلاق النظام عن الجميع
              </>
            )}
          </button>
        )}
      </div>

      {/* Analytics Tab */}
      {activeTab === "analytics" && <AnalyticsDashboard dbTools={dbTools} user={user} subDepartments={subDepartments} />}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add User Form */}
          <div className="lg:col-span-1 glass-panel p-8">
            <h3 className="text-2xl font-extrabold text-white mb-8 flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl">
                <Plus className="text-blue-400" />
              </div>
              إنشاء حساب مستخدم جديد
            </h3>
            <form onSubmit={handleAddUser} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                  اسم الموظف الثلاثي (الظاهر)
                </label>
                <input
                  type="text"
                  value={newUser.fullName}
                  onChange={(e) =>
                    setNewUser({ ...newUser, fullName: e.target.value })
                  }
                  className="premium-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                  اسم المستخدم (للدخول)
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className="premium-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                  كلمة المرور (ثابتة)
                </label>
                <input
                  type="text"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className="premium-input font-mono tracking-widest"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                  مستوى الصلاحية
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                  className="premium-input bg-slate-900"
                >
                  <option value="employee">مستخدم (صلاحيات وصول مقيدة)</option>
                  <option value="supervisor">
                    مشرف قسم (صلاحية على أقسام محددة)
                  </option>
                  {(user.Role === "admin" || user.Role === "assistant" || user.Role === "manager") && (
                    <>
                      <option value="department_manager">
                        مسؤول قسم (Department Manager)
                      </option>
                      <option value="assistant">مساعد مدير (مراقبة عامة)</option>
                    </>
                  )}
                  {user.Role === "admin" && (
                    <option value="admin">
                      المدير العام (تحكم كامل بجميع الموارد)
                    </option>
                  )}
                </select>
              </div>

              {(newUser.role === "employee" ||
                newUser.role === "supervisor" ||
                newUser.role === "department_manager") && (
                <div className="pt-6 border-t border-white/5">
                  <label className="block text-sm font-bold text-slate-300 mb-4 ml-1">
                    تخصيص مساحات العمل المسموحة
                  </label>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-4 pr-3">
                    {departments.map((dep) => (
                      <div
                        key={dep.Id}
                        className="bg-slate-900/60 p-4 rounded-2xl border border-white/5"
                      >
                        <div
                          className="flex items-center justify-between mb-3 cursor-pointer group"
                          onClick={() => toggleDepartmentSelection(dep.Id)}
                        >
                          <p className="text-sm font-extrabold text-blue-400 group-hover:text-blue-300 transition-colors">
                            {dep.Name}
                          </p>
                          <span className="text-[10px] text-slate-500 group-hover:text-slate-400 bg-white/5 px-2 py-1 rounded-md">
                            تحديد الكل
                          </span>
                        </div>
                        <div className="flex flex-col gap-3">
                          {subDepartments
                            .filter((s) => s.DepartmentId === dep.Id)
                            .map((sub) => {
                              const isChecked = newUser.allowedSubs.includes(
                                sub.Id.toString(),
                              );
                              return (
                                <div
                                  key={sub.Id}
                                  className="flex items-center gap-4 cursor-pointer group"
                                  onClick={() => toggleSubSelection(sub.Id)}
                                >
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${isChecked ? "bg-blue-600 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-slate-800 border-slate-600 group-hover:border-blue-400"}`}
                                  >
                                    {isChecked && (
                                      <CheckSquare
                                        size={16}
                                        className="text-white"
                                      />
                                    )}
                                  </div>
                                  <span
                                    className={`text-sm font-bold transition-colors ${isChecked ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}
                                  >
                                    {sub.Name}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Backup Section */}
              {user.Role === "admin" && (
                <>
                  <div className="glass-panel p-6 rounded-[2rem] flex flex-col items-center text-center gap-4 border border-blue-500/20 mt-6 relative overflow-hidden group">
                    <div className="absolute top-[-50%] left-[-50%] w-full h-full bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500 pointer-events-none"></div>
                    <div className="relative z-10">
                      <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        <Download className="text-blue-400" size={28} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        النسخ الاحتياطي الذكي
                      </h3>
                      <p className="text-slate-400 text-xs font-medium px-2 leading-relaxed">
                        يتم حفظ الداتا محلياً بشكل تلقائي كل 6 ساعات.
                      </p>
                    </div>
                    <div className="flex flex-col w-full gap-3 relative z-10 mt-2">
                      <button
                        onClick={handleBackup}
                        className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/50 rounded-xl font-extrabold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2 hover:-translate-y-1"
                      >
                        <Download size={18} /> سحب نسخة يدوية
                      </button>
                      <button
                        onClick={openBackupFolder}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        فتح مجلد النسخ 📂
                      </button>
                    </div>
                  </div>

                  <div className="glass-panel p-6 rounded-[2rem] flex flex-col items-center text-center gap-4 border border-red-500/20 mt-6 relative overflow-hidden group">
                    <div className="absolute top-[-50%] left-[-50%] w-full h-full bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all duration-500 pointer-events-none"></div>
                    <div className="relative z-10">
                      <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                        <Trash2 className="text-red-400" size={28} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        صيانة النظام
                      </h3>
                      <p className="text-slate-400 text-xs font-medium px-2 leading-relaxed">
                        يتم مسح المهملات آلياً بعد مرور 24 ساعة، أو مسحها يدوياً.
                      </p>
                    </div>
                    <div className="flex flex-col w-full gap-3 relative z-10 mt-2">
                      <button
                        onClick={handleEmptyTrash}
                        className="w-full py-3 bg-red-600 hover:bg-red-500 text-white border border-red-500/50 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 size={18} /> تفريغ سلة المهملات
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={submittingUser}
                className="glow-button w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-lg rounded-2xl mt-6 shadow-lg disabled:opacity-50"
              >
                {submittingUser ? "جاري الإنشاء..." : "إنشاء حساب الموظف"}
              </button>
            </form>
          </div>

          {/* Users List */}
          <div className="lg:col-span-2 glass-panel overflow-hidden flex flex-col">
            <div className="p-8 border-b border-white/5 bg-slate-900/40">
              <h3 className="text-2xl font-extrabold text-white flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl">
                  <ShieldCheck className="text-indigo-400" />
                </div>
                سجل المستخدمين والصلاحيات
              </h3>
            </div>
            <div className="overflow-x-auto flex-1 p-2">
              <table className="w-full text-right">
                <thead className="bg-slate-900/50 text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="p-5 font-bold text-sm tracking-wider uppercase">
                      اسم الموظف
                    </th>
                    <th className="p-5 font-bold text-sm tracking-wider uppercase">
                      اسم الدخول (Username)
                    </th>
                    <th className="p-5 font-bold text-sm tracking-wider uppercase">
                      الرتبة
                    </th>
                    <th className="p-5 font-bold text-sm tracking-wider uppercase">
                      القسم
                    </th>
                    <th className="p-5 font-bold text-sm tracking-wider uppercase">
                      تاريخ الانضمام
                    </th>
                    <th className="p-5 font-bold text-sm tracking-wider uppercase text-center">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsersList.map((u) => {
                        let allowed = [];
                        try {
                          if (u.AllowedSubDepartments === '"all"' || u.AllowedSubDepartments === "all" || u.AllowedSubDepartments === '["all"]') {
                            allowed = ["all"];
                          } else {
                            const parsed = JSON.parse(u.AllowedSubDepartments || "[]");
                            if (Array.isArray(parsed)) allowed = parsed;
                          }
                        } catch (e) {}

                      return (
                        <tr
                          key={u.Id}
                          className="hover:bg-white/5 transition-colors group"
                        >
                          <td className="p-5 text-sm font-bold text-white">
                            {u.FullName || u.Username}
                          </td>
                          <td className="p-5 text-sm font-bold text-blue-400">
                            {u.Username}
                          </td>
                          <td className="p-5">
                            <div className="flex flex-col gap-2 items-center">
                              <span
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                                  u.Role === "admin"
                                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                                    : u.Role === "assistant"
                                      ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                      : (u.Role === "supervisor" || u.Role === "manager" || u.Role === "department_manager")
                                        ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                        : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                }`}
                              >
                                {u.Role === "admin"
                                  ? "مدير عام"
                                  : u.Role === "assistant"
                                    ? "مساعد مدير"
                                    : (u.Role === "supervisor" || u.Role === "manager" || u.Role === "department_manager")
                                      ? "مشرف قسم"
                                      : "موظف"}
                              </span>
                              {callManagers[u.Id] && callManagers[u.Id].length > 0 && (
                                <span className="text-[10px] font-bold px-2 py-1 rounded-lg border bg-teal-500/10 border-teal-500/20 text-teal-400">
                                  مسؤول اتصالات
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-5">
                            {(u.Role !== "employee" &&
                              u.Role !== "supervisor" && u.Role !== "manager" && u.Role !== "department_manager") ||
                            allowed.includes("all") ? (
                              <span className="text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20 text-sm">
                                وصول غير محدود (الكل)
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1 justify-end max-w-[250px]">
                                {allowed.length > 0 ? (
                                  [
                                    ...new Set(
                                      allowed
                                        .map(
                                          (id) =>
                                            subDepartments.find(
                                              (sub) => sub.Id.toString() === String(id),
                                            )?.DepartmentId,
                                        )
                                        .filter(Boolean),
                                    ),
                                  ].map((depId) => {
                                    const d = departments.find(
                                      (dep) => dep.Id === depId,
                                    );
                                    return d ? (
                                      <span
                                        key={depId}
                                        className="text-slate-300 font-bold text-xs bg-slate-800 px-2 py-1 rounded-md border border-white/5"
                                      >
                                        {d.Name}
                                      </span>
                                    ) : null;
                                  })
                                ) : (
                                  <span className="text-slate-500 text-xs font-bold">
                                    لا يوجد صلاحيات
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-5 text-slate-500 font-bold text-sm">
                            {formatBaghdadTime(u.CreatedAt, false)}
                          </td>
                          <td className="p-5">
                            {(u.Role !== "admin" ||
                              user.Username === "T8#vQ2!mL9@rPx7") &&
                              u.Username !== "T8#vQ2!mL9@rPx7" && (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    title="تعديل بيانات المستخدم"
                                    className="text-slate-500 hover:text-blue-400 transition-colors p-2 hover:bg-blue-500/10 rounded-lg"
                                    onClick={() => {
                                      setChangePasswordUser({
                                        id: u.Id,
                                        username: u.Username,
                                        fullName: u.FullName,
                                        type: "change",
                                      });
                                      setNewUsernameValue(u.Username);
                                      setNewFullNameValue(u.FullName || "");
                                    }}
                                  >
                                    <Settings size={18} />
                                  </button>
                                  <button
                                    title="تعديل صلاحيات الموظف"
                                    className="text-slate-500 hover:text-green-400 transition-colors p-2 hover:bg-green-500/10 rounded-lg"
                                    onClick={() => {
                                      let currentDeps = [];
                                      try {
                                        currentDeps = JSON.parse(
                                          u.AllowedSubDepartments || "[]",
                                        );
                                      } catch (e) {}
                                      setSelectedEditDeps(currentDeps);
                                      setEditDepartmentsUser({
                                        id: u.Id,
                                        username: u.Username,
                                        role: u.Role,
                                      });
                                    }}
                                  >
                                    <FolderPlus size={18} />
                                  </button>
                                  <button
                                    title="تعديل مهام الاتصالات"
                                    className="text-slate-500 hover:text-teal-400 transition-colors p-2 hover:bg-teal-500/10 rounded-lg"
                                    onClick={() => {
                                      const mgrs = callManagers[u.Id] || [];
                                      setSelectedCallManagerDeps(mgrs);
                                      setEditCallManagerUser({
                                        id: u.Id,
                                        username: u.Username,
                                        role: u.Role,
                                      });
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/></svg>
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteUser(u.Id, u.Role, u.Username)
                                    }
                                    className="px-3 py-1.5 bg-white/5 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    حذف
                                  </button>
                                </div>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inactive Users Cleanup */}
          {inactiveUsers.length > 0 && (
            <div className="lg:col-span-3 glass-panel p-8 mt-6">
              <h3 className="text-xl font-extrabold text-white mb-4 flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-xl">
                  <Trash2 className="text-red-400" />
                </div>
                تنظيف إدخالات الموظفين المحذوفين
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                هذه القائمة تعرض الموظفين الذين تم تعطيل حساباتهم مسبقاً، يمكنك
                مسح جميع إدخالاتهم وسجلاتهم نهائياً لتنظيف قاعدة البيانات.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {inactiveUsers.map((iu) => (
                  <div
                    key={iu.Id}
                    className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-red-500/30 transition-all"
                  >
                    <div className="flex flex-col">
                      <span className="text-white font-bold">
                        {iu.Username}
                      </span>
                      <span className="text-xs text-slate-500">تم التعطيل</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setChangePasswordUser({
                            id: iu.Id,
                            username: iu.Username,
                            type: "restore",
                          })
                        }
                        className="px-4 py-2 bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white rounded-xl font-bold text-sm transition-colors border border-green-500/20"
                      >
                        استرجاع
                      </button>
                      <button
                        onClick={() => {
                          setConfirmConfig({
                            title: "مسح السجلات نهائياً",
                            message: `هل أنت متأكد من مسح جميع إدخالات وسجلات الموظف "${iu.Username}" نهائياً من كل النظام؟ لا يمكن التراجع عن هذا الإجراء!`,
                            confirmText: "مسح نهائي",
                            onConfirm: async () => {
                              setConfirmConfig(null);
                              const ipcRenderer =
                                window.require("electron").ipcRenderer;
                              const result = await ipcRenderer.invoke(
                                "delete-user-advanced",
                                {
                                  targetUserId: iu.Id,
                                  deleteRecords: true,
                                  adminId: user.Id,
                                },
                              );
                              if (result.success) {
                                toast.success(
                                  "تم مسح إدخالات الموظف وحذف حسابه نهائياً",
                                );
                                loadData();
                              } else {
                                toast.error("حدث خطأ: " + result.error);
                              }
                            },
                            onCancel: () => setConfirmConfig(null),
                          });
                        }}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl font-bold text-sm transition-colors border border-red-500/20"
                      >
                        مسح السجلات
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit User Departments Modal */}
      {editDepartmentsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-xl w-full shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setEditDepartmentsUser(null)}
              className="absolute top-6 left-6 text-slate-500 hover:text-white transition-colors"
            >
              &times;
            </button>
            <h2 className="text-2xl font-extrabold text-white mb-6">
              تعديل أقسام الموظف:{" "}
              <span className="text-blue-400">
                {editDepartmentsUser.username}
              </span>
            </h2>
            <form onSubmit={handleSaveUserDepartments} className="space-y-6">
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="space-y-2 mb-6">
                  <label className="block text-sm font-bold text-slate-400 mb-2">مستوى الصلاحية (Role)</label>
                  <select
                    value={editDepartmentsUser.role}
                    onChange={(e) => setEditDepartmentsUser({ ...editDepartmentsUser, role: e.target.value })}
                    className="premium-input bg-slate-900"
                  >
                    <option value="employee">موظف (Employee)</option>
                    <option value="supervisor">مشرف قسم (Supervisor)</option>
                    {(user.Role === "admin" || user.Role === "assistant" || user.Role === "manager") && (
                      <>
                        <option value="department_manager">مسؤول قسم (Department Manager)</option>
                        <option value="assistant">مساعد مدير (Assistant)</option>
                      </>
                    )}
                    {user.Role === "admin" && (
                      <option value="admin">مدير نظام (Admin)</option>
                    )}
                  </select>
                </div>
                
                <h4 className="font-bold text-slate-300">
                  النوافذ المتاحة لهذا الموظف:
                </h4>
                <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500">
                  <input
                    type="checkbox"
                    checked={selectedEditDeps.includes("all")}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedEditDeps(["all"]);
                      else setSelectedEditDeps([]);
                    }}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
                  />
                  <span className="font-bold">
                    وصول كامل لجميع النوافذ (All)
                  </span>
                </label>
                {!selectedEditDeps.includes("all") &&
                  departments.map((dep) => (
                    <details
                      key={dep.Id}
                      className="group border border-white/10 rounded-xl bg-slate-900/40 mt-4 overflow-hidden"
                    >
                      <summary className="p-4 font-bold text-blue-400 cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-colors flex justify-between items-center outline-none">
                        {dep.Name}
                        <span className="text-slate-500 text-sm group-open:hidden">▼</span>
                        <span className="text-slate-500 text-sm hidden group-open:block">▲</span>
                      </summary>
                      <div className="grid grid-cols-1 gap-2 p-4 border-t border-white/5 max-h-[30vh] overflow-y-auto custom-scrollbar">
                        {subDepartments
                          .filter((s) => s.DepartmentId === dep.Id)
                          .map((sub) => (
                            <label
                              key={sub.Id}
                              className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-white/5 cursor-pointer hover:bg-slate-900/60"
                            >
                              <input
                                type="checkbox"
                                checked={selectedEditDeps.includes(
                                  sub.Id.toString(),
                                )}
                                onChange={(e) => {
                                  if (e.target.checked)
                                    setSelectedEditDeps([
                                      ...selectedEditDeps,
                                      sub.Id.toString(),
                                    ]);
                                  else
                                    setSelectedEditDeps(
                                      selectedEditDeps.filter(
                                        (id) => id !== sub.Id.toString(),
                                      ),
                                    );
                                }}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-green-500 focus:ring-green-500 focus:ring-offset-slate-800"
                              />
                              <span className="text-sm font-bold text-slate-300">
                                {sub.Name}
                              </span>
                            </label>
                          ))}
                      </div>
                    </details>
                  ))}
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-500/20"
                >
                  حفظ التغييرات
                </button>
                <button
                  type="button"
                  onClick={() => setEditDepartmentsUser(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === "departments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-panel p-8">
            <h3 className="text-2xl font-extrabold text-white mb-8 flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl">
                <Folder className="text-blue-400" />
              </div>
              انشاء قسم رئيسي
            </h3>
            <form
              onSubmit={handleAddDepartment}
              className="flex gap-3 mb-10 pb-10 border-b border-white/5"
            >
              <input
                type="text"
                value={newDep}
                onChange={(e) => setNewDep(e.target.value)}
                placeholder="اسم القسم الرئيسي (مثال: المبيعات والاستثمار)"
                className="premium-input flex-1"
                required
              />
              <button
                type="submit"
                className="glow-button px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg"
              >
                <Plus size={20} /> إضافة
              </button>
            </form>

            <h3 className="text-2xl font-extrabold text-white mb-8 flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-xl">
                <FolderPlus className="text-green-400" />
              </div>
              إضافة قسم فرعي
            </h3>
            <form onSubmit={handleAddSubDepartment} className="space-y-5">
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar border border-white/10 rounded-xl p-3 bg-slate-900/50">
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  اختر الأقسام الرئيسية (يمكنك اختيار أكثر من قسم)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {departments.map((d) => (
                    <label key={d.Id} className="flex items-center gap-3 p-3 hover:bg-slate-800 border border-white/5 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={newSub.depIds.includes(d.Id.toString()) || newSub.depIds.includes(d.Id)}
                        onChange={(e) => {
                          const idStr = d.Id.toString();
                          if (e.target.checked) {
                            setNewSub({ ...newSub, depIds: [...newSub.depIds, idStr] });
                          } else {
                            setNewSub({ ...newSub, depIds: newSub.depIds.filter(id => id !== idStr) });
                          }
                        }}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-green-500 cursor-pointer"
                      />
                      <span className="text-slate-200 font-bold text-sm">{d.Name}</span>
                    </label>
                  ))}
                </div>
                {newSub.depIds.length === 0 && (
                  <p className="text-red-400 text-xs mt-2 font-bold">يرجى اختيار قسم رئيسي واحد على الأقل</p>
                )}
              </div>
              <div className="space-y-2 mb-4 border border-white/10 rounded-xl p-3 bg-slate-900/50">
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  اختر نوع الأقسام الفرعية (يمكنك اختيار أكثر من نوع)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { val: "الاتصالات", label: "الاتصالات" },
                    { val: "الاتصالات المطلوبة", label: "الاتصالات المطلوبة (الطلبات)" },
                    { val: "المواعيد", label: "المواعيد" },
                    { val: "متابعة الاتصالات", label: "متابعة الاتصالات" },
                    { val: "العقارات", label: "العقارات" },
                    { val: "العملاء", label: "العملاء" },
                    { val: "الوكلاء", label: "الوكلاء (الدلالين)" },
                    { val: "مخصص", label: "مخصص (نموذج موحد)" },
                  ].map((opt) => (
                    <label key={opt.val} className="flex items-center gap-3 p-2 hover:bg-slate-800 border border-white/5 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={newSub.names.includes(opt.val)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewSub({ ...newSub, names: [...newSub.names, opt.val] });
                          } else {
                            setNewSub({ ...newSub, names: newSub.names.filter(n => n !== opt.val) });
                          }
                        }}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-green-500 cursor-pointer"
                      />
                      <span className="text-slate-200 font-bold text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {newSub.names.length === 0 && (
                  <p className="text-red-400 text-xs mt-2 font-bold">يرجى اختيار نوع قسم فرعي واحد على الأقل</p>
                )}
              </div>
              
              {newSub.names.includes("مخصص") && (
                <input
                  type="text"
                  value={newSub.customName}
                  onChange={(e) =>
                    setNewSub({ ...newSub, customName: e.target.value })
                  }
                  placeholder="اكتب اسم القسم المخصص..."
                  className="premium-input"
                  required
                />
              )}
              <button
                type="submit"
                className="glow-button w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-lg shadow-lg"
              >
                <Plus size={20} /> إضافة القسم الفرعي
              </button>
            </form>
          </div>

          <div className="glass-panel p-8 h-[700px] overflow-y-auto custom-scrollbar">
            <h3 className="text-2xl font-extrabold text-white mb-8 border-b border-white/5 pb-5">
              الأقسام
            </h3>
            {departments.length === 0 ? (
              <p className="text-slate-500 text-center py-12 font-bold text-lg">
                لم يتم بناء الأقسام بعد
              </p>
            ) : (
              <div className="space-y-6">
                {departments.map((dep) => (
                  <div
                    key={dep.Id}
                    className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 shadow-inner"
                  >
                    <div className="flex items-center justify-between mb-5">
                      <h4 className="font-extrabold text-xl text-blue-400 flex items-center gap-2">
                        <Folder size={20} /> {dep.Name}
                      </h4>
                      <button
                        onClick={() => handleDeleteDepartment(dep.Id)}
                        className="text-slate-500 hover:text-red-400 p-2 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20 text-xs font-bold"
                      >
                        حذف القسم
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {subDepartments
                        .filter((s) => s.DepartmentId === dep.Id)
                        .map((sub) => (
                          <div
                            key={sub.Id}
                            className="px-4 py-2 bg-slate-800 border border-white/10 rounded-xl text-sm font-bold text-slate-300 shadow-sm flex items-center gap-3"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                              {sub.Name}
                            </div>
                            <button
                              onClick={() => handleDeleteSubDepartment(sub.Id)}
                              className="text-slate-500 hover:text-red-400 mr-2 p-1 rounded transition-colors"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      {subDepartments.filter((s) => s.DepartmentId === dep.Id)
                        .length === 0 && (
                        <span className="text-slate-500 text-xs font-bold bg-white/5 px-3 py-1.5 rounded-lg">
                          فارغ، لا يوجد نوافذ عمل هنا
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Categories Tab */}
      {activeTab === "categories" && (
        <div className="glass-panel overflow-hidden flex flex-col">
          <div className="p-8 border-b border-white/5 bg-slate-900/40 flex justify-between items-center">
            <h3 className="text-2xl font-extrabold text-white flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl">
                <Database className="text-emerald-400" />
              </div>
              إدارة التصنيفات والنتائج المخصصة
            </h3>
          </div>
          <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-right">
              <thead className="bg-slate-900/50 text-slate-400 border-b border-white/5">
                <tr>
                  <th className="p-5 font-bold text-sm tracking-wider uppercase">
                    اسم التصنيف
                  </th>
                  <th className="p-5 font-bold text-sm tracking-wider uppercase">
                    القسم الفرعي
                  </th>
                  <th className="p-5 font-bold text-sm tracking-wider uppercase">
                    تاريخ الإضافة
                  </th>
                  <th className="p-5 font-bold text-sm tracking-wider uppercase text-left">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {customCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="p-8 text-center text-slate-500 font-bold"
                    >
                      لا توجد تصنيفات مخصصة مضافة حالياً
                    </td>
                  </tr>
                ) : (
                  customCategories.map((c) => (
                    <tr
                      key={c.Id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="p-5 font-bold text-white text-sm">
                        {c.Name}
                      </td>
                      <td className="p-5 font-bold text-indigo-400 text-sm">
                        {c.SubDepartmentId ? (subDepartments.find(s => s.Id === c.SubDepartmentId)?.Name || "غير معروف") : "عام (قديم)"}
                      </td>
                      <td className="p-5 font-bold text-slate-500 text-sm">
                        {formatBaghdadTime(c.CreatedAt, false)}
                      </td>
                      <td className="p-5 text-left">
                        <button
                          onClick={() => handleDeleteCustomCategory(c.Id)}
                          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors"
                        >
                          حذف وإخفاء
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Edit CallManager Modal */}
      {editCallManagerUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div
            className="bg-slate-900 border border-teal-500/30 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative"
            dir="rtl"
          >
            <h3 className="text-3xl font-extrabold text-white mb-2 tracking-wide flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M14.05 2a9 9 0 0 1 8 7.94"/><path d="M14.05 6A5 5 0 0 1 18 10"/></svg>
              مهام إدارة الاتصالات
            </h3>
            <p className="text-slate-400 mb-8 font-bold">
              تحديد الشعب التي يحق للمستخدم استقبال وإضافة اتصالاتها (للموظف:{" "}
              <span className="text-teal-400 font-bold">
                {editCallManagerUser.username}
              </span>
              )
            </p>

            <form onSubmit={handleSaveCallManagers} className="space-y-6">
              <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-4 pr-3">
                {departments
                  .filter((dep) =>
                    subDepartments.some(
                      (s) =>
                        s.DepartmentId === dep.Id &&
                        s.Name.includes("مطلوب") &&
                        s.Name.includes("اتصال"),
                    ),
                  )
                  .map((dep) => (
                    <details
                      key={dep.Id}
                      className="group bg-slate-900/60 rounded-2xl border border-white/5 overflow-hidden"
                    >
                      <summary className="flex items-center gap-3 p-4 text-teal-400 cursor-pointer bg-slate-800/30 hover:bg-slate-800/50 transition-colors outline-none">
                        <Folder size={18} />
                        <h4 className="font-extrabold flex-1 text-right">{dep.Name}</h4>
                        <span className="text-slate-500 text-sm group-open:hidden">▼</span>
                        <span className="text-slate-500 text-sm hidden group-open:block">▲</span>
                      </summary>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border-t border-white/5 bg-slate-900/40">
                        {subDepartments
                          .filter(
                            (sub) =>
                              sub.DepartmentId === dep.Id &&
                              sub.Name.includes("مطلوب") &&
                              sub.Name.includes("اتصال"),
                          )
                          .map((sub) => {
                          const isSelected = selectedCallManagerDeps.includes(
                            sub.Id.toString(),
                          );
                          return (
                            <label
                              key={sub.Id}
                              className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer border transition-all duration-300 ${
                                isSelected
                                  ? "bg-teal-500/20 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.1)]"
                                  : "bg-slate-800/50 border-white/5 hover:border-teal-500/30"
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded flex items-center justify-center border ${
                                  isSelected
                                    ? "bg-teal-500 border-teal-500 text-white"
                                    : "border-slate-600 bg-slate-900"
                                }`}
                              >
                                {isSelected && <CheckSquare size={14} />}
                              </div>
                              <span
                                className={`font-bold text-sm ${isSelected ? "text-white" : "text-slate-400"}`}
                              >
                                {sub.Name}
                              </span>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedCallManagerDeps(
                                      selectedCallManagerDeps.filter(
                                        (id) => id !== sub.Id.toString(),
                                      ),
                                    );
                                  } else {
                                    setSelectedCallManagerDeps([
                                      ...selectedCallManagerDeps,
                                      sub.Id.toString(),
                                    ]);
                                  }
                                }}
                              />
                            </label>
                          );
                        })}
                    </div>
                  </details>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditCallManagerUser(null)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-l from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-teal-500/25"
                >
                  <Save size={20} /> حفظ المهام
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal {...(confirmConfig || {})} isOpen={!!confirmConfig} />

      {/* Confirmation Modal */}
      {changePasswordUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 animate-fade-in p-4">
          <div className="bg-slate-900 w-full max-w-sm rounded-[2rem] border-t-2 border-blue-500 shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="p-6 bg-blue-500/10 text-center relative">
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <Key className="text-blue-400" size={30} />
              </div>
              <h3 className="text-xl font-black text-white">
                {changePasswordUser.type === "restore"
                  ? "استرجاع الموظف"
                  : "تعديل بيانات المستخدم"}
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                {changePasswordUser.username}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {changePasswordUser.type === "change" && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">
                      اسم الموظف (الظاهر)
                    </label>
                    <input
                      type="text"
                      value={newFullNameValue}
                      onChange={(e) => setNewFullNameValue(e.target.value)}
                      className="premium-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">
                      اسم الدخول (Username)
                    </label>
                    <input
                      type="text"
                      value={newUsernameValue}
                      onChange={(e) => setNewUsernameValue(e.target.value)}
                      className="premium-input w-full"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  {changePasswordUser.type === "restore"
                    ? "كلمة المرور الجديدة"
                    : "كلمة المرور (اختياري للتغيير)"}
                </label>
                <input
                  type="text"
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  className="premium-input w-full"
                  placeholder={
                    changePasswordUser.type === "restore"
                      ? "اكتب كلمة المرور"
                      : "اتركه فارغاً لعدم التغيير"
                  }
                  autoFocus
                />
              </div>
            </div>
            <div className="p-6 bg-slate-900/50 border-t border-white/5 flex gap-4">
              <button
                onClick={() => {
                  setChangePasswordUser(null);
                  setNewPasswordValue("");
                  setNewFullNameValue("");
                  setNewUsernameValue("");
                }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-slate-700"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  if (
                    changePasswordUser.type === "restore" &&
                    !newPasswordValue.trim()
                  ) {
                    toast.error("الرجاء كتابة كلمة المرور الجديدة");
                    return;
                  }
                  if (
                    changePasswordUser.type === "change" &&
                    !newUsernameValue.trim()
                  ) {
                    toast.error("اسم الدخول مطلوب");
                    return;
                  }
                  setIsSavingPassword(true);
                  const ipcRenderer = window.require("electron").ipcRenderer;
                  const action =
                    changePasswordUser.type === "restore"
                      ? "restore-user"
                      : "edit-user-details";
                  const result = await ipcRenderer.invoke(action, {
                    targetUserId: changePasswordUser.id,
                    newFullName: newFullNameValue,
                    newUsername: newUsernameValue,
                    newPassword: newPasswordValue,
                    adminId: user.Id,
                  });
                  if (result.success) {
                    toast.success(
                      changePasswordUser.type === "restore"
                        ? "تم استرجاع الموظف بنجاح"
                        : "تم تعديل بيانات المستخدم بنجاح",
                    );
                    setChangePasswordUser(null);
                    setNewPasswordValue("");
                    setNewFullNameValue("");
                    setNewUsernameValue("");
                    loadData();
                  } else {
                    toast.error(result.error);
                  }
                  setIsSavingPassword(false);
                }}
                disabled={isSavingPassword}
                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)] disabled:opacity-50"
              >
                {isSavingPassword ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
