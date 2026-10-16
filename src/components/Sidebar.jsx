import React, { useState, useEffect } from "react";
import {
  Grid,
  MessageSquare,
  Activity,
  Settings,
  LogOut,
  RefreshCcw,
  ChevronLeft,
} from "lucide-react";
import packageJson from "../../package.json";
import { getUserDisplayLabel } from "../utils/roleLabels";
import { getIpcRenderer } from "../utils/ipc";

const Sidebar = ({ user, currentView, setCurrentView, handleLogout }) => {
  const [updateState, setUpdateState] = useState("idle"); // idle, checking, downloading, downloaded
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    const ipc = getIpcRenderer();
    if (ipc) {
      const handleUpdateAvailable  = () => setUpdateState("checking");
      const handleUpdateProgress   = (_, percent) => { setUpdateState("downloading"); setUpdateProgress(percent); };
      const handleUpdateDownloaded = () => setUpdateState("downloaded");
      const handleUpdateError      = () => setUpdateState("idle");

      ipc.on("update_available",  handleUpdateAvailable);
      ipc.on("update_progress",   handleUpdateProgress);
      ipc.on("update_downloaded", handleUpdateDownloaded);
      ipc.on("update_error",      handleUpdateError);

      return () => {
        ipc.removeListener("update_available",  handleUpdateAvailable);
        ipc.removeListener("update_progress",   handleUpdateProgress);
        ipc.removeListener("update_downloaded", handleUpdateDownloaded);
        ipc.removeListener("update_error",      handleUpdateError);
      };
    }
  }, []);

  const menuItems = [
    { id: "departments", icon: Grid, label: "الأقسام", visible: true },
    {
      id: "requests",
      icon: MessageSquare,
      label: "مركز الطلبات",
      visible: true,
    },
    {
      id: "activity",
      icon: Activity,
      label: "سجل العمليات",
      visible: user?.Role === "admin" || user?.Role === "assistant",
    },
    {
      id: "admin",
      icon: Settings,
      label: "لوحة الإدارة",
      // Only admin, assistant, and department_manager see admin panel
      // supervisor and employee do NOT see it
      visible: user?.Role === "admin" || user?.Role === "assistant" || user?.Role === "department_manager",
    },
  ].filter((item) => item.visible);

  // ─── Role label (uses shared utility to avoid duplicate logic) ────────────
  const roleLabel = getUserDisplayLabel(user);

  return (
    <aside
      className="hidden md:flex w-72 flex-col h-full relative flex-shrink-0"
      style={{
        background: "#09090b", // Zinc 950
        borderLeft: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "-10px 0 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: "linear-gradient(90deg, transparent, #3b82f6, #6366f1)",
        }}
      />

      {/* ─── LOGO SECTION (ZOOMED) ─── */}
      <div
        className="px-6 pt-10 pb-6 flex flex-col items-center"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="flex items-center justify-center mb-6"
          style={{
            width: 140,
            height: 140, // ZOOM IN
            background: "rgba(255,255,255,0.02)",
            borderRadius: "24px",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 20px -5px rgba(0,0,0,0.5)",
          }}
        >
          <img
            src="./logo.png"
            alt="RD Logo"
            style={{
              width: 120,
              height: 120,
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
            }}
          />
        </div>

        <h1
          className="text-2xl font-black text-white text-center mb-1"
          style={{ letterSpacing: "-0.3px" }}
        >
          شركة المستشار
        </h1>
        <p
          className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: "#a1a1aa" }}
        >
          قسم البحث والتطوير
        </p>
        <div
          className="px-4 py-1.5 rounded-full text-xs font-bold"
          style={{
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            color: "#818cf8",
          }}
        >
          إعداد: جعفر الركابي
        </div>
      </div>

      {/* ─── NAVIGATION ─── */}
      <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 font-bold transition-all duration-200 text-right relative overflow-hidden group"
              style={
                isActive
                  ? {
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#f4f4f5",
                    borderRadius: "16px",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  }
                  : {
                    background: "transparent",
                    border: "1px solid transparent",
                    color: "#a1a1aa",
                    borderRadius: "16px",
                  }
              }
              onMouseEnter={
                !isActive
                  ? (e) => {
                    e.currentTarget.style.background =
                      "rgba(255,255,255,0.02)";
                    e.currentTarget.style.color = "#e4e4e7";
                  }
                  : undefined
              }
              onMouseLeave={
                !isActive
                  ? (e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#a1a1aa";
                  }
                  : undefined
              }
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                style={
                  isActive
                    ? {
                      background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                      boxShadow:
                        "0 4px 10px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                    }
                    : {
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }
                }
              >
                <IconComponent
                  size={18}
                  style={{ color: isActive ? "#fff" : "#818cf8" }}
                />
              </div>

              <span className="relative z-10 text-[15px] font-bold flex-1">
                {item.label}
              </span>

              {isActive && (
                <ChevronLeft
                  size={16}
                  className="relative z-10"
                  style={{ color: "#818cf8" }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* ─── USER + FOOTER ─── */}
      <div
        className="px-4 pb-6 pt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* User Card */}
        <div
          className="flex items-center gap-3 p-3 mb-3"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "16px",
          }}
        >
          <div
            className="w-10 h-10 flex items-center justify-center font-black text-white text-lg flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              borderRadius: "14px",
              boxShadow:
                "0 4px 10px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            {(user?.FullName || user?.Username || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold text-white truncate">
              {user?.FullName || user?.Username}
            </p>
            <p
              className="text-xs font-bold mt-0.5"
              style={{ color: "#818cf8" }}
            >
              {roleLabel}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 font-bold text-sm transition-all duration-200 group mb-3"
          style={{
            background: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.1)",
            color: "#f87171",
            borderRadius: "16px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
            e.currentTarget.style.color = "#fca5a5";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.05)";
            e.currentTarget.style.color = "#f87171";
          }}
        >
          <LogOut size={16} />
          تسجيل الخروج
        </button>

        {/* Version + Update */}
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: "#52525b" }}>
              v {packageJson.version}
            </span>
            <button
              onClick={async () => {
                const ipc = getIpcRenderer();
                if (ipc) {
                  const { default: toast } = await import("react-hot-toast");
                  const toastId = toast.loading("جاري الفحص...", { id: "upd" });
                  try {
                    const res = await ipc.invoke("check-for-updates");
                    if (res.success) {
                      toast.success(res.message, { id: toastId });
                    } else {
                      toast.error(res.message || "خطأ في الفحص", { id: toastId });
                    }
                  } catch {
                    toast.error("خطأ في الفحص", { id: toastId });
                  }
                }
              }}
              className="flex items-center gap-1.5 text-xs font-bold transition-colors duration-150"
              style={{ color: "#64748b" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#60a5fa")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            >
              <RefreshCcw size={12} />
              فحص التحديثات
            </button>
          </div>
          {updateState === "downloading" ? (
            <div className="w-full flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                <span>جاري التحميل ...</span>
                <span>{Math.round(updateProgress)}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-1.5 transition-all duration-300"
                  style={{ width: `${updateProgress}%` }}
                />
              </div>
            </div>
          ) : updateState === "downloaded" ? (
            <button
              onClick={async () => {
                const ipc = getIpcRenderer();
                if (ipc) await ipc.invoke("quit-and-install");
              }}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-md text-xs font-bold transition-all duration-150 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            >
              <RefreshCcw size={14} className="animate-spin" />
              تثبيت وإعادة التشغيل
            </button>
          ) : (
            <button
              onClick={async () => {
                const ipc = getIpcRenderer();
                if (ipc) {
                  const { default: toast } = await import("react-hot-toast");
                  try {
                    const res = await ipc.invoke("download-update");
                    if (res.success) {
                      setUpdateState("downloading");
                      toast.success(res.message);
                    } else {
                      toast.error(res.message || "خطأ في التحميل");
                    }
                  } catch {
                    toast.error("خطأ في التحميل");
                  }
                }
              }}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md text-xs font-bold transition-all duration-150 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
            >
              <RefreshCcw size={12} />
              تحميل أخر تحديث
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default React.memo(Sidebar);
