import React, { useState } from "react";
import {
  Grid,
  MessageSquare,
  Activity,
  Settings,
  Bell,
  LogOut,
  X,
  Menu,
  ShieldCheck,
  RefreshCw,
  User as UserIcon,
  ChevronLeft,
} from "lucide-react";
import { getUserDisplayLabel } from "../../utils/roleLabels";

export default function MobileNavigation({
  user,
  currentView,
  setCurrentView,
  selectedSubDepartment,
  notificationsCount = 0,
  onOpenNotifications,
  handleLogout,
  onRefresh,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const roleLabel = getUserDisplayLabel(user);

  const navItems = [
    { id: "departments", icon: Grid, label: "الأقسام", visible: true },
    {
      id: "requests",
      icon: MessageSquare,
      label: "الطلبات",
      visible: true,
    },
    {
      id: "activity",
      icon: Activity,
      label: "السجل",
      visible: user?.Role === "admin" || user?.Role === "assistant",
    },
    {
      id: "admin",
      icon: Settings,
      label: "الإدارة",
      visible:
        user?.Role === "admin" ||
        user?.Role === "assistant" ||
        user?.Role === "department_manager",
    },
  ].filter((item) => item.visible);

  const handleRefreshClick = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 600);
      }
    }
  };

  const getPageTitle = () => {
    if (currentView === "admin") {
      return user?.Role === "admin" ? "لوحة الإدارة العامة" : "إدارة القسم";
    }
    if (currentView === "departments") return "الأقسام والمساحات";
    if (currentView === "subdepartment") {
      return selectedSubDepartment?.Name || "تفاصيل القسم";
    }
    if (currentView === "requests") return "مركز الطلبات";
    if (currentView === "activity") return "سجل العمليات";
    return "RD Manager";
  };

  return (
    <>
      {/* ─── MOBILE TOP APP BAR ─────────────────────────────────────── */}
      <header
        className="md:hidden flex items-center justify-between px-4 h-16 z-40 sticky top-0 flex-shrink-0"
        style={{
          background: "rgba(9, 9, 11, 0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
          paddingTop: "max(env(safe-area-inset-top), 6px)",
        }}
      >
        {/* Right side: Drawer Toggle + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5 active:scale-90 border border-white/10 text-slate-200 transition-transform shadow-md"
            aria-label="القائمة"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-9 h-9 rounded-xl object-contain drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-wide truncate max-w-[140px]">
                {getPageTitle()}
              </span>
              <span className="text-[10px] font-bold text-indigo-400">
                Enterprise Cloud
              </span>
            </div>
          </div>
        </div>

        {/* Left side: Refresh & Notification */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={handleRefreshClick}
              className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 text-slate-300 border border-white/5 active:scale-90 transition-transform ${
                isRefreshing ? "animate-spin text-blue-400" : ""
              }`}
              title="تحديث البيانات"
            >
              <RefreshCw size={17} />
            </button>
          )}

          <button
            onClick={onOpenNotifications}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 text-slate-300 border border-white/5 active:scale-90 transition-transform"
            aria-label="الإشعارات"
          >
            <Bell size={18} />
            {notificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-black rounded-full bg-red-500 text-white flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse">
                {notificationsCount > 99 ? "99+" : notificationsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ─── MOBILE FLOATING BOTTOM DOCK ────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-3 left-3 right-3 z-40"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
        }}
      >
        <div
          className="flex items-center justify-around px-2 py-2.5 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] border border-white/10"
          style={{
            background: "rgba(12, 11, 26, 0.88)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentView === item.id ||
              (item.id === "departments" && currentView === "subdepartment");

            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  if (drawerOpen) setDrawerOpen(false);
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl relative transition-all duration-300 active:scale-90 ${
                  isActive
                    ? "text-white font-black"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {/* Active Glowing Pill Background */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-2xl -z-10 shadow-[0_0_20px_rgba(99,102,241,0.35)]"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(99, 102, 241, 0.28) 0%, rgba(59, 130, 246, 0.2) 100%)",
                      border: "1px solid rgba(129, 140, 248, 0.35)",
                    }}
                  />
                )}

                <Icon
                  size={21}
                  className={`transition-transform duration-200 ${
                    isActive
                      ? "scale-110 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]"
                      : "text-slate-400"
                  }`}
                />
                <span
                  className={`text-[11px] mt-1 transition-all ${
                    isActive ? "font-black text-indigo-200" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Profile / Menu Tab */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl active:scale-90 transition-all ${
              drawerOpen ? "text-white" : "text-slate-400"
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-sm">
              <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
                <UserIcon size={13} className="text-indigo-300" />
              </div>
            </div>
            <span className="text-[11px] mt-1 font-medium">حسابي</span>
          </button>
        </div>
      </nav>

      {/* ─── MOBILE SLIDE-OVER DRAWER ────────────────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div
            className="relative w-4/5 max-w-sm h-full flex flex-col z-10 animate-slide-left shadow-2xl"
            style={{
              background: "#0c0a1f",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              paddingTop: "max(env(safe-area-inset-top), 20px)",
              paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
            }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]"
                />
                <div>
                  <h3 className="text-base font-black text-white">
                    RD Manager
                  </h3>
                  <span className="text-xs text-indigo-400 font-bold">
                    إصدار الأندرويد v1.0.20
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 text-slate-400 active:scale-90"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="p-5">
              <div
                className="p-4 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(30, 27, 75, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)",
                }}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-600 p-0.5 shadow-md">
                    <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-lg font-black text-white">
                      {(user?.FullName || user?.Username || "U")[0].toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-extrabold text-white truncate">
                      {user?.FullName || user?.Username}
                    </h4>
                    <p className="text-xs text-slate-400 truncate">
                      @{user?.Username}
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      <ShieldCheck size={11} />
                      {roleLabel}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span>حالة الاتصال:</span>
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    خادم Enterprise متصل
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="flex-1 px-4 space-y-2 overflow-y-auto">
              <button
                onClick={() => {
                  setCurrentView("departments");
                  setDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-sm font-bold ${
                  currentView === "departments"
                    ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30"
                    : "bg-white/5 text-slate-200 border-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Grid size={18} />
                  <span>تصفح كل الأقسام</span>
                </div>
                <ChevronLeft size={16} />
              </button>

              <button
                onClick={() => {
                  setCurrentView("requests");
                  setDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-sm font-bold ${
                  currentView === "requests"
                    ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30"
                    : "bg-white/5 text-slate-200 border-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare size={18} />
                  <span>مركز الطلبات والمتابعة</span>
                </div>
                <ChevronLeft size={16} />
              </button>

              {(user?.Role === "admin" || user?.Role === "assistant") && (
                <button
                  onClick={() => {
                    setCurrentView("activity");
                    setDrawerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-sm font-bold ${
                    currentView === "activity"
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30"
                      : "bg-white/5 text-slate-200 border-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Activity size={18} />
                    <span>سجل النشاطات الكامل</span>
                  </div>
                  <ChevronLeft size={16} />
                </button>
              )}

              {(user?.Role === "admin" ||
                user?.Role === "assistant" ||
                user?.Role === "department_manager") && (
                <button
                  onClick={() => {
                    setCurrentView("admin");
                    setDrawerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-sm font-bold ${
                    currentView === "admin"
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30"
                      : "bg-white/5 text-slate-200 border-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Settings size={18} />
                    <span>لوحة إدارة النظام</span>
                  </div>
                  <ChevronLeft size={16} />
                </button>
              )}
            </div>

            {/* Logout Button */}
            <div className="p-5 border-t border-white/10">
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2.5 p-3.5 rounded-2xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 font-black text-sm active:scale-95 transition-all shadow-md"
              >
                <LogOut size={18} />
                <span>تسجيل الخروج من الحساب</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
