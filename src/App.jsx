import React, { useState, useEffect, Suspense, lazy } from "react";
import Sidebar from "./components/Sidebar";
import AuthScreen from "./components/AuthScreen";
import DepartmentsView from "./components/DepartmentsView";
import MobileNavigation from "./components/mobile/MobileNavigation";
import { useDB } from "./hooks/useDB";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import { Toaster, toast } from "react-hot-toast";
import { Bell, Clock } from "lucide-react";
import { getIpcRenderer } from "./utils/ipc";
import { getUserDisplayLabel } from "./utils/roleLabels";

const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const DataTableView = lazy(() => import("./components/DataTableView"));
const RequestsView = lazy(() => import("./components/RequestsView"));
const ActivityLogView = lazy(() => import("./components/ActivityLogView"));

const App = () => {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState("departments");
  const [selectedSubDepartment, setSelectedSubDepartment] = useState(null);
  const [pendingFormData, setPendingFormData] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [isRestoringSession, setIsRestoringSession] = useState(
    !!localStorage.getItem("rd_user_session"),
  );

  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const [pendingAppointmentPrompt, setPendingAppointmentPrompt] = useState(null);
  const [promptDismissedIds, setPromptDismissedIds] = useState(new Set());

  // Auto Updater State
  const [updateState, setUpdateState] = useState({
    isUpdating: false,
    progress: 0,
    isReady: false,
    error: null,
  });

  // Global Lock State
  const [isGloballyLocked, setIsGloballyLocked] = useState(false);

  useEffect(() => {
    const validateUser = async () => {
      const savedUser = localStorage.getItem("rd_user_session");
      if (!savedUser) {
        setIsRestoringSession(false);
        return;
      }
      let parsed = null;
      try {
        parsed = JSON.parse(savedUser);
        const ipcRenderer = getIpcRenderer();
        if (ipcRenderer) {
          let isConnected = false;
          let retries = 0;
          while (!isConnected && retries < 25) { // max 5 seconds wait (200ms * 25)
            const connRes = await ipcRenderer.invoke("check-db-connection");
            if (connRes && connRes.connected) {
              isConnected = true;
            } else {
              await new Promise((r) => setTimeout(r, 200));
              retries++;
            }
          }

          if (isConnected) {
            // 2. Fast check using dedicated verify-session endpoint
            const res = await ipcRenderer.invoke("verify-session", { userId: parsed.Id });
            
            if (res && res.success && res.user) {
              setUser({ ...parsed, ...res.user });
            } else {
              // User deleted or deactivated - explicitly log them out
              localStorage.removeItem("rd_user_session");
              setUser(null);
            }
          } else {
            // If DB didn't connect in time, fallback to cached session to not block the UI indefinitely
            setUser(parsed);
          }
        } else {
          setUser(parsed);
        }
      } catch (e) {
        console.error("Auto-login error:", e);
        // Fallback to cached user if possible, else logout
        if (parsed) {
          setUser(parsed);
        } else {
          localStorage.removeItem("rd_user_session");
          setUser(null);
        }
      } finally {
        setIsRestoringSession(false);
      }
    };
    validateUser();

    // Auto Refresh Logic (Every 60 minutes) — warns 30s before
    const REFRESH_INTERVAL = 60 * 60 * 1000; // 60 minutes
    const WARNING_TIME = 30 * 1000; // 30 seconds warning

    const refreshTimer = setInterval(() => {
      toast(
        "سيتم تحديث مزامنة النظام تلقائياً بعد 30 ثانية. يرجى حفظ أي بيانات قيد الإدخال.",
        {
          icon: "🔄",
          duration: WARNING_TIME,
          style: { background: "#f59e0b", color: "#fff", fontWeight: "bold" },
        },
      );

      setTimeout(() => {
        setRefreshKey((prev) => prev + 1);
        toast.success("تم مزامنة النظام بنجاح");
      }, WARNING_TIME);
    }, REFRESH_INTERVAL);

    // IPC Listeners for Auto Updater
    const ipcRenderer = getIpcRenderer();
    if (ipcRenderer) {
      const handleUpdateAvailable = () =>
        setUpdateState((prev) => ({
          ...prev,
          isUpdating: true,
          progress: 0,
          isReady: false,
        }));
      const handleUpdateProgress = (e, percent) =>
        setUpdateState((prev) => ({ ...prev, progress: Math.floor(percent) }));
      const handleUpdateDownloaded = () =>
        setUpdateState((prev) => ({ ...prev, progress: 100, isReady: true }));
      const handleUpdateError = (e, err) =>
        setUpdateState((prev) => ({ ...prev, error: err }));

      ipcRenderer.on("update_available", handleUpdateAvailable);
      ipcRenderer.on("update_progress", handleUpdateProgress);
      ipcRenderer.on("update_downloaded", handleUpdateDownloaded);
      ipcRenderer.on("update_error", handleUpdateError);

      // Safe to check now that listeners are active
      ipcRenderer.invoke("check-for-updates");

      // Listen for reminder notifications from backend - only show for current user
      const handleReminderNotification = (e, payload) => {
        // Check if the logged-in user is the one who created the reminder
        const currentUser = JSON.parse(localStorage.getItem("rd_user_session") || "null");
        if (!currentUser || String(currentUser.Id) !== String(payload.userId)) return;

        // Show in-app toast
        toast(`⏰ تذكير: ${payload.title || payload.name || "سجل"}\nالوقت المتبقي: ${payload.diffMins} دقيقة`, {
          duration: 10000,
          style: { background: "#312e81", color: "#fff", fontWeight: "bold", direction: "rtl" },
        });

        // Show OS desktop notification (Web Notifications API - user-specific)
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const n = new Notification("⏰ تذكير بموعد / اتصال", {
            body: `${payload.title || payload.name || "سجل"}\nالوقت المتبقي: ${payload.diffMins} دقيقة`,
            requireInteraction: true,
          });
          n.onclick = () => window.focus();
        } else if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
          Notification.requestPermission().then(perm => {
            if (perm === "granted") {
              new Notification("⏰ تذكير بموعد / اتصال", {
                body: `${payload.title || payload.name || "سجل"}\nالوقت المتبقي: ${payload.diffMins} دقيقة`,
              });
            }
          });
        }
      };

      ipcRenderer.on("reminder_notification", handleReminderNotification);

      return () => {
        clearInterval(refreshTimer);
        ipcRenderer.removeListener("update_available", handleUpdateAvailable);
        ipcRenderer.removeListener("update_progress", handleUpdateProgress);
        ipcRenderer.removeListener("update_downloaded", handleUpdateDownloaded);
        ipcRenderer.removeListener("update_error", handleUpdateError);
        ipcRenderer.removeListener("reminder_notification", handleReminderNotification);
      };
    }

    return () => clearInterval(refreshTimer);
  }, []);

  // Admin Auto-Backup Timer (Only runs on the Admin's computer while logged in)
  useEffect(() => {
    if (!user || user.Role !== "admin") return;

    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) return;

    const BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
    const backupTimer = setInterval(() => {
      ipcRenderer.invoke("take-backup", { userId: user.Id }).then((res) => {
        if (res.success) {
          toast.success("تم إنشاء وحفظ نسخة احتياطية تلقائية بنجاح", {
            icon: "💾",
          });
        }
      });
    }, BACKUP_INTERVAL);

    return () => clearInterval(backupTimer);
  }, [user]);

  // Global App Lock Polling (Every 10 seconds)
  useEffect(() => {
    const ipcRenderer = getIpcRenderer();
    if (!ipcRenderer) return;

    const checkLockStatus = async () => {
      try {
        const res = await ipcRenderer.invoke("get-app-lock-status");
        if (res && res.success) {
          setIsGloballyLocked(res.isLocked);
        }
      } catch (err) {
        console.error("Failed to check app lock status:", err);
      }
    };

    // Check immediately, then every 10 seconds
    checkLockStatus();
    const lockTimer = setInterval(checkLockStatus, 10000);

    return () => clearInterval(lockTimer);
  }, []);

  const handleInstallUpdate = () => {
    const ipcRenderer = window.require
      ? window.require("electron").ipcRenderer
      : null;
    if (ipcRenderer) {
      ipcRenderer.invoke("quit-and-install");
    }
  };

  const handleLogin = (userData) => {
    localStorage.setItem("rd_user_session", JSON.stringify(userData));
    setUser(userData);
    if (dbTools.clearCache) {
      dbTools.clearCache();
    }
  };

  const handleLogout = async () => {
    const ipcRenderer = getIpcRenderer();
    if (ipcRenderer && user) {
      await ipcRenderer.invoke("logout", { userId: user.Id });
    }
    setUser(null);
    localStorage.removeItem("rd_user_session");
  };

  // ─── DB Tools ────────────────────────────────────────────────────────────
  // NOTE: Must be declared BEFORE handleLogin / handleLogout which reference it.
  const dbTools = useDB(user);

  useEffect(() => {
    if (!user) return;
    if (currentView !== "admin") {
      const preload = async () => {
        try {
          await dbTools.fetchTable("Departments", true);
          await dbTools.fetchTable("SubDepartments", true);
          await dbTools.fetchTable("Users", true);
          await dbTools.fetchTable("CustomCategories", true);
        } catch (err) {
          console.error("Preload error:", err);
        }
      };
      preload();
    }
  }, [user, currentView]); // only when user or currentView changes

  useEffect(() => {
    if (!user) return;

    const fetchNotifs = async () => {
      // Don't poll when a prompt is already blocking the UI
      if (pendingAppointmentPrompt) return;
      try {
        // ─── 1. Use cached data — no force-refresh here ───────────────────
        const users   = await dbTools.fetchTable("Users", false);
        const subDeps = await dbTools.fetchTable("SubDepartments", false);
        // Filter to only this user's records BEFORE fetching to avoid parsing thousands of rows
        const recs    = await dbTools.fetchTable("Records", false);
        const myRecs  = (recs || []).filter(r => r.CreatedBy_UserId === user.Id);

        // ─── 2. Sync user role / permissions if changed by admin ──────────
        if (users && users.length > 0) {
          const updatedUser = users.find(u => u.Id === user.Id);
          if (updatedUser) {
            if (
              updatedUser.Role !== user.Role ||
              updatedUser.CallManagerSubs !== user.CallManagerSubs
            ) {
              setUser(updatedUser);
              localStorage.setItem("rd_user_session", JSON.stringify(updatedUser));
              import("react-hot-toast").then(m =>
                m.default.success("تم تحديث صلاحياتك من قبل الإدارة"),
              );
            }
          }
        }

        // ─── 3. Build appointment / comms sub-department ID sets ──────────
        const apptSubDepsIds = new Set(
          (subDeps || [])
            .filter(s => s.Name?.includes("مواعيد"))
            .map(s => String(s.Id)),
        );
        const commsSubDepsIds = new Set(
          (subDeps || [])
            .filter(s => s.Name?.includes("اتصال") || s.Name?.includes("تسويق"))
            .map(s => String(s.Id)),
        );

        // ─── 4. Loop only the current user's records ──────────────────────
        const now = new Date();
        const activeNotifs = [];
        let pastDueAppt = null;

        for (const r of myRecs) {
          try {
            const data = r.ParsedContent || JSON.parse(r.Content);
            if (!data.datetime) continue;

            const apptTime = new Date(data.datetime);
            const diffMins = (apptTime - now) / 60000;

            // Reminder notification
            if (data.reminder && !data.uiAcknowledge) {
              const reminderTarget =
                data.reminder === "custom"
                  ? parseInt(data.customReminder || 0) * 24 * 60
                  : parseInt(data.reminder);

              if (diffMins <= reminderTarget && diffMins > -1440) {
                activeNotifs.push({ id: r.Id, data, time: apptTime });
              }
            }

            // Past-due prompt
            const isAppt = apptSubDepsIds.has(String(r.SubDepartmentId));
            const isComm = commsSubDepsIds.has(String(r.SubDepartmentId));

            if ((isAppt || isComm) && !promptDismissedIds.has(String(r.Id))) {
              const status = data.status || "قيد الانتظار";
              if (diffMins < 0 && !pastDueAppt) {
                if (isAppt && status === "قيد الانتظار") {
                  pastDueAppt = { rec: r, data, step: 1, type: "appt" };
                } else if (isComm && status === "إعادة اتصال") {
                  pastDueAppt = { rec: r, data, step: 1, type: "comm" };
                } else if (isComm && status === "تم الاتصال" && data.scheduleAnotherCall) {
                  pastDueAppt = { rec: r, data, step: 1, type: "comm_followup" };
                }
              }
            }
          } catch (_) {}
        }

        activeNotifs.sort((a, b) => b.time - a.time);
        setNotifications(activeNotifs);
        if (pastDueAppt) setPendingAppointmentPrompt(pastDueAppt);
      } catch (e) {
        console.error("fetchNotifs error:", e);
      }
    };

    fetchNotifs();
    // Reduced from 10s → 30s: cached data makes this cheap but no need to run every 10s
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user, pendingAppointmentPrompt, promptDismissedIds]);

  const handleAcknowledge = async (id, data) => {
    const ipcRenderer = getIpcRenderer();
    data.uiAcknowledge = true;
    data.reminded = true;
    await ipcRenderer.invoke("update-record", {
      table: "Records",
      id: id,
      userId: user.Id,
      data: { Content: JSON.stringify(data) },
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (isRestoringSession) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-5">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-2">
          جاري التحقق من اليوزر نيم والباسورد...
        </h1>
        <p className="text-slate-500 font-bold tracking-wider text-sm animate-pulse">
          يرجى الانتظار، يتم الآن الاتصال بخادم Enterprise والتأكد من بياناتك...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const handleTransferCall = async (data) => {
    const ipcRenderer = getIpcRenderer();
    const res = await ipcRenderer.invoke("get-table-data", {
      table: "SubDepartments",
    });
    if (res.success && Array.isArray(res.data)) {
      // Find a sub-department that includes 'اتصال' but not 'مطلوب'
      const targetSub = res.data.find(
        (sub) => sub.Name.includes("اتصال") && !sub.Name.includes("مطلوب"),
      );
      if (targetSub) {
        setPendingFormData(data);
        setSelectedSubDepartment(targetSub);
        setCurrentView("subdepartment");
        import("react-hot-toast").then((m) =>
          m.default.success(
            "تم نقل البيانات بنجاح، يرجى استكمال تسجيل النتيجة.",
          ),
        );
      } else {
        import("react-hot-toast").then((m) =>
          m.default.error("لم يتم العثور على قسم الاتصالات الأساسي!"),
        );
      }
    }
  };

  const handleTransferToRequested = async (data) => {
    const ipcRenderer = getIpcRenderer();
    const res = await ipcRenderer.invoke("get-table-data", {
      table: "SubDepartments",
    });
    if (res.success && Array.isArray(res.data)) {
      // Find a sub-department that includes 'مطلوب' and 'اتصال'
      const targetSub = res.data.find(
        (sub) => sub.Name.includes("اتصال") && sub.Name.includes("مطلوب") && !sub.Name.includes("متابعة"),
      );
      if (targetSub) {
        setPendingFormData(data);
        setSelectedSubDepartment(targetSub);
        setCurrentView("subdepartment");
        import("react-hot-toast").then((m) =>
          m.default.success(
            "تم نقل البيانات بنجاح، يرجى الاستكمال والحفظ.",
          ),
        );
      } else {
        import("react-hot-toast").then((m) =>
          m.default.error("لم يتم العثور على قسم الاتصالات المطلوبة!"),
        );
      }
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case "admin":
        return (
          <AdminDashboard
            dbTools={dbTools}
            user={user}
            onNavigate={setCurrentView}
            isGloballyLocked={isGloballyLocked}
            setIsGloballyLocked={setIsGloballyLocked}
          />
        );
      case "subdepartment":
        return (
          <DataTableView
            dbTools={dbTools}
            user={user}
            subDepartment={selectedSubDepartment}
            onBack={() => setCurrentView("departments")}
            onTransferCall={handleTransferCall}
            onTransferToRequested={handleTransferToRequested}
            pendingFormData={pendingFormData}
            setPendingFormData={setPendingFormData}
          />
        );
      case "requests":
        return <RequestsView dbTools={dbTools} user={user} />;
      case "activity":
        return <ActivityLogView dbTools={dbTools} user={user} />;
      case "departments":
      default:
        return (
          <DepartmentsView
            dbTools={dbTools}
            user={user}
            onSelectSub={(sub) => {
              setSelectedSubDepartment(sub);
              setCurrentView("subdepartment");
            }}
          />
        );
    }
  };

  // ══════════════════════════════════════════════════════════
  //  🔒  DYNAMIC MASTER LOCK
  // ══════════════════════════════════════════════════════════
  const isAdmin = user?.Role === "admin" && user?.Username === "T8#vQ2!mL9@rPx7";
  if (isGloballyLocked && !isAdmin) {
    return (
      <div
        dir="rtl"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999999,
          background: "linear-gradient(160deg, #04030d 0%, #07051a 50%, #0c0a24 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Cairo', 'Tajawal', sans-serif",
          userSelect: "none",
          pointerEvents: "all",
        }}
      >
        {/* Animated background blobs */}
        <div style={{
          position: "absolute", top: "20%", left: "10%",
          width: 400, height: 400,
          background: "rgba(13,71,161,0.08)",
          borderRadius: "50%", filter: "blur(80px)",
          animation: "pulse 6s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "15%", right: "8%",
          width: 350, height: 350,
          background: "rgba(33,150,243,0.06)",
          borderRadius: "50%", filter: "blur(100px)",
          animation: "pulse 8s ease-in-out infinite reverse",
        }} />

        {/* Lock Icon Container */}
        <div style={{
          width: 120, height: 120,
          background: "rgba(13,71,161,0.15)",
          border: "1px solid rgba(33,150,243,0.25)",
          borderRadius: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 36,
          boxShadow: "0 0 60px rgba(33,150,243,0.15), 0 0 120px rgba(13,71,161,0.1)",
          animation: "lockPulse 3s ease-in-out infinite",
        }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="60"
            height="60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2196F3"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          color: "#fff",
          fontSize: 28,
          fontWeight: 900,
          marginBottom: 12,
          letterSpacing: "-0.5px",
          textAlign: "center",
        }}>
          تم إغلاق النظام
        </h1>

        {/* Divider */}
        <div style={{
          width: 60, height: 2,
          background: "linear-gradient(90deg, transparent, #2196F3, transparent)",
          marginBottom: 24,
          borderRadius: 2,
        }} />

        {/* Message */}
        <p style={{
          color: "#90CAF9",
          fontSize: 16,
          fontWeight: 700,
          textAlign: "center",
          maxWidth: 380,
          lineHeight: 1.8,
          padding: "0 24px",
        }}>
          الرجاء عدم التواصل مع الدعم الفني
        </p>
        <p style={{
          color: "rgba(144,202,249,0.5)",
          fontSize: 13,
          fontWeight: 600,
          textAlign: "center",
          maxWidth: 360,
          lineHeight: 1.7,
          padding: "8px 24px 0",
        }}>
          تم إغلاق هذا التطبيق بشكل كامل ونهائي
        </p>

        {/* Version */}
        <div style={{
          position: "absolute",
          bottom: 24,
          color: "rgba(33,150,243,0.2)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
        }}>
          v1.0.17
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;900&display=swap');
          @keyframes lockPulse {
            0%, 100% { box-shadow: 0 0 60px rgba(33,150,243,0.15), 0 0 120px rgba(13,71,161,0.1); }
            50% { box-shadow: 0 0 80px rgba(33,150,243,0.3), 0 0 160px rgba(13,71,161,0.2); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className="flex h-screen text-slate-200 font-sans overflow-hidden"
        dir="rtl"
        style={{
          background:
            "linear-gradient(160deg, #04030d 0%, #07051a 40%, #0c0a24 100%)",
        }}
      >
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: "#18181b", // Zinc 900
              color: "#f4f4f5",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              fontWeight: "bold",
              fontSize: "14px",
              padding: "16px 24px",
              fontFamily: "Tajawal, sans-serif",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#18181b" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#18181b" },
            },
          }}
        />
        <Sidebar
          user={user}
          currentView={currentView}
          setCurrentView={setCurrentView}
          handleLogout={handleLogout}
        />

        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Mobile Navigation (Top App Bar, Floating Bottom Dock, Slide Drawer) */}
          <MobileNavigation
            user={user}
            currentView={currentView}
            setCurrentView={setCurrentView}
            selectedSubDepartment={selectedSubDepartment}
            notificationsCount={notifications.length}
            onOpenNotifications={() => setShowNotifMenu(!showNotifMenu)}
            handleLogout={handleLogout}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />

          {/* ─── DESKTOP HEADER (hidden on mobile) ─── */}
          <header
            className="hidden md:flex h-16 items-center justify-between px-8 z-[100] flex-shrink-0"
            style={{
              background: "rgba(9, 9, 11, 0.8)", // Zinc 950 translucent
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {/* Left: Page title */}
            <div className="flex items-center gap-4">
              <div
                className="w-1.5 h-6 rounded-full"
                style={{
                  background: "linear-gradient(180deg, #6366f1, #3b82f6)",
                }}
              />
              <h2 className="text-xl font-extrabold text-white tracking-wide">
                {currentView === "admin"
                  ? (user?.Role === "admin" ? "لوحة التحكم الإدارية" : "لوحة إدارة القسم")
                  : currentView === "departments"
                    ? "الأقسام ومساحات العمل"
                    : currentView === "subdepartment"
                      ? selectedSubDepartment?.Name
                      : currentView === "requests"
                        ? "مركز الطلبات والدعم"
                        : currentView === "activity"
                          ? "سجل العمليات"
                          : "النظام الإداري"}
              </h2>
            </div>

            {/* Right: Bell + User */}
            <div className="flex items-center gap-4 relative z-50">
              {/* Notification Bell */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    className="relative w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-200"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.08)";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.03)";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <Bell size={20} style={{ color: "#a1a1aa" }} />
                    {notifications.length > 0 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black border-2"
                        style={{
                          background: "#ef4444",
                          borderColor: "#09090b",
                          boxShadow: "0 4px 10px rgba(239, 68, 68, 0.4)",
                        }}
                      >
                        {notifications.length}
                      </span>
                    )}
                  </button>

                  {showNotifMenu && (
                    <div
                      className="absolute top-14 left-0 w-80 rounded-2xl z-50 overflow-hidden flex flex-col animate-slide-up"
                      style={{
                        background: "#100d2e",
                        border: "1px solid rgba(99,88,180,0.25)",
                        boxShadow:
                          "0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,0,0,0.4)",
                      }}
                    >
                      <div
                        className="px-4 py-3 flex justify-between items-center"
                        style={{
                          borderBottom: "1px solid rgba(99,88,180,0.15)",
                        }}
                      >
                        <h3 className="font-extrabold text-white text-sm">
                          الإشعارات والتذكيرات
                        </h3>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(124,58,237,0.15)",
                            border: "1px solid rgba(124,58,237,0.25)",
                            color: "#a78bfa",
                          }}
                        >
                          {notifications.length} جديد
                        </span>
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
                        {notifications.length === 0 ? (
                          <div
                            className="p-6 text-center text-xs font-bold"
                            style={{ color: "#4b5563" }}
                          >
                            لا توجد إشعارات جديدة
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className="p-3 rounded-xl mb-1 text-right"
                              style={{
                                background: "rgba(99,88,180,0.05)",
                                border: "1px solid rgba(99,88,180,0.1)",
                              }}
                            >
                              <h4 className="font-bold text-sm mb-1" style={{ color: "#818cf8" }}>
                                {n.data.title || n.data.name || "تذكير"}
                              </h4>
                              <p
                                className="text-xs mb-2"
                                style={{ color: "#6b7280" }}
                              >
                                {n.time.toLocaleString("ar-IQ")}
                              </p>
                              <button
                                onClick={() => handleAcknowledge(n.id, n.data)}
                                className="text-xs px-3 py-1.5 rounded-lg w-full font-bold transition-colors duration-150"
                                style={{
                                  background: "rgba(124,58,237,0.1)",
                                  border: "1px solid rgba(124,58,237,0.2)",
                                  color: "#a78bfa",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background =
                                    "rgba(74,222,128,0.1)";
                                  e.currentTarget.style.color = "#4ade80";
                                  e.currentTarget.style.borderColor =
                                    "rgba(74,222,128,0.25)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background =
                                    "rgba(124,58,237,0.1)";
                                  e.currentTarget.style.color = "#a78bfa";
                                  e.currentTarget.style.borderColor =
                                    "rgba(124,58,237,0.2)";
                                }}
                              >
                                ✓ تأكيد المشاهدة (إخفاء)
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User chip */}
              <div
                className="flex items-center gap-3 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20"
              >
                <div className="notif-dot" />
                <span
                  className="text-sm font-bold text-slate-300"
                >
                  {user.FullName || user.Username}
                </span>
                <span className="text-slate-700">|</span>
                <span
                  className="text-sm font-bold text-blue-500"
                >
                  {getUserDisplayLabel(user)}
                </span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-3.5 sm:p-6 md:p-8 pb-32 md:pb-8 scroll-smooth custom-scrollbar relative">
            <div
              className="relative z-10 max-w-[1600px] 2xl:max-w-[1920px] mx-auto"
              key={refreshKey}
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-64 w-full">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                  </div>
                }
              >
                {renderContent()}
              </Suspense>
            </div>
          </div>

          {/* Copyright Footer */}
          <footer
            className="h-10 flex items-center justify-center text-xs font-bold tracking-widest relative z-10"
            style={{
              background: "#04030d",
              borderTop: "1px solid rgba(99,88,180,0.12)",
              color: "rgba(75,85,99,0.8)",
            }}
          >
            <span style={{ color: "rgba(124,58,237,0.4)" }}>©</span>
            &nbsp;2026&nbsp;
            <span style={{ color: "rgba(55,65,81,0.8)" }}>|</span>
            &nbsp;شركة المستشار المؤسسي&nbsp;
            <span style={{ color: "rgba(55,65,81,0.8)" }}>|</span>
            &nbsp;
            <span style={{ color: "rgba(99,88,180,0.6)" }}>
              قسم البحث والتطوير: جعفر الركابي
            </span>
          </footer>
        </main>

      {pendingAppointmentPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4 animate-fade-in" style={{ direction: "rtl" }}>
          <div className="bg-slate-900 rounded-[2rem] max-w-lg w-full flex flex-col border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.5)] overflow-hidden text-center">
            <div className="p-8">
              <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Clock size={32} />
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-4">
                {pendingAppointmentPrompt.type === "comm" ? "تنبيه انتهاء موعد اتصال" : "تنبيه انتهاء موعد"}
              </h2>
              
              {pendingAppointmentPrompt.step === 1 && (
                <>
                  <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                    {pendingAppointmentPrompt.type === "comm" ? (
                      <>هل قمت بإجراء الاتصال بـ <b>{pendingAppointmentPrompt.data.name || pendingAppointmentPrompt.data.title}</b>؟</>
                    ) : pendingAppointmentPrompt.type === "comm_followup" ? (
                      <>هل تم الاتصال مرة أخرى بـ <b>{pendingAppointmentPrompt.data.name || pendingAppointmentPrompt.data.title}</b>؟</>
                    ) : (
                      <>هل تم إكمال موعد <b>{pendingAppointmentPrompt.data.title || pendingAppointmentPrompt.data.name}</b>؟</>
                    )}
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={async () => {
                        const ipcRenderer = getIpcRenderer();
                        const recId = pendingAppointmentPrompt.rec.Id;
                        const updatedData = { ...pendingAppointmentPrompt.data, status: (pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "تم الاتصال" : "موعد مكتمل" };
                        if (pendingAppointmentPrompt.type === "comm_followup") {
                          updatedData.scheduleAnotherCall = false; // completed the follow-up
                        }
                        await ipcRenderer.invoke("update-record", {
                          table: "Records",
                          id: recId,
                          userId: user.Id,
                          data: {
                            SearchIndex: Object.values(updatedData).join(" ").toLowerCase(),
                            Content: JSON.stringify(updatedData)
                          }
                        });
                        setPromptDismissedIds(new Set([...promptDismissedIds, String(recId)]));
                        setPendingAppointmentPrompt(null);
                        toast.success((pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "تم تحديث الاتصال إلى تم الاتصال" : "تم تحديث الموعد إلى مكتمل");
                      }}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
                    >
                      {(pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "نعم، تم الاتصال" : "نعم، تم الإكمال"}
                    </button>
                    <button
                      onClick={() => setPendingAppointmentPrompt({ ...pendingAppointmentPrompt, step: 2 })}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-slate-700"
                    >
                      كلا
                    </button>
                  </div>
                </>
              )}

              {pendingAppointmentPrompt.step === 2 && (
                <>
                  <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                    {pendingAppointmentPrompt.type === "comm" 
                      ? "هل تريد جدولة الاتصال مرة أخرى أم أن العميل لا يرد؟"
                      : pendingAppointmentPrompt.type === "comm_followup"
                      ? "هل تريد تأجيل وتحديد موعد آخر للاتصال أم أن العميل لا يرد؟"
                      : "هل تريد تعديل الموعد (تأجيله) أم جعله لم يأتِ؟"
                    }
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setPendingAppointmentPrompt({ ...pendingAppointmentPrompt, step: 3, newDate: pendingAppointmentPrompt.data.datetime })}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
                    >
                      {(pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "إعادة الجدولة" : "تأجيل الموعد"}
                    </button>
                    <button
                      onClick={async () => {
                        const ipcRenderer = getIpcRenderer();
                        const recId = pendingAppointmentPrompt.rec.Id;
                        const updatedData = { ...pendingAppointmentPrompt.data, status: (pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "إعادة اتصال" : "لم يحضر" };
                        
                        if (pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") {
                          delete updatedData.datetime;
                          delete updatedData.reminder;
                          delete updatedData.customReminder;
                          delete updatedData.scheduleAnotherCall;
                        }

                        await ipcRenderer.invoke("update-record", {
                          table: "Records",
                          id: recId,
                          userId: user.Id,
                          data: {
                            SearchIndex: Object.values(updatedData).join(" ").toLowerCase(),
                            Content: JSON.stringify(updatedData)
                          }
                        });
                        setPromptDismissedIds(new Set([...promptDismissedIds, String(recId)]));
                        setPendingAppointmentPrompt(null);
                        toast.success((pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "تم تسجيل الاتصال كـ لا يرد وإعادته لحالة الانتظار" : "تم تسجيل الموعد كـ لم يحضر");
                      }}
                      className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-slate-700"
                    >
                      {(pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "لا يرد" : "لم يأتِ"}
                    </button>
                  </div>
                </>
              )}

              {pendingAppointmentPrompt.step === 3 && (
                <>
                  <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                    {(pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "اختر التاريخ والوقت الجديد للاتصال القادم:" : "اختر التاريخ والوقت الجديد للموعد:"}
                  </p>
                  <input
                    type="datetime-local"
                    value={pendingAppointmentPrompt.newDate || ""}
                    onChange={(e) => setPendingAppointmentPrompt({ ...pendingAppointmentPrompt, newDate: e.target.value })}
                    className="w-full p-4 rounded-xl bg-slate-950 border border-slate-700 text-white text-lg mb-6"
                    dir="ltr"
                  />
                  <div className="flex gap-4">
                    <button
                      onClick={async () => {
                        if (!pendingAppointmentPrompt.newDate) return toast.error("يرجى اختيار التاريخ الجديد");
                        const ipcRenderer = getIpcRenderer();
                        const recId = pendingAppointmentPrompt.rec.Id;
                        const updatedData = { ...pendingAppointmentPrompt.data, datetime: pendingAppointmentPrompt.newDate, status: (pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "إعادة اتصال" : "قيد الانتظار" };
                        if (pendingAppointmentPrompt.type === "comm_followup") {
                          delete updatedData.scheduleAnotherCall; // if they rescheduled from follow up, it becomes a regular 'إعادة اتصال'
                        }
                        await ipcRenderer.invoke("update-record", {
                          table: "Records",
                          id: recId,
                          userId: user.Id,
                          data: {
                            SearchIndex: Object.values(updatedData).join(" ").toLowerCase(),
                            Content: JSON.stringify(updatedData)
                          }
                        });
                        setPromptDismissedIds(new Set([...promptDismissedIds, String(recId)]));
                        setPendingAppointmentPrompt(null);
                        toast.success((pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "تمت جدولة الاتصال بنجاح" : "تم تأجيل وتحديث الموعد بنجاح");
                      }}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
                    >
                      {(pendingAppointmentPrompt.type === "comm" || pendingAppointmentPrompt.type === "comm_followup") ? "حفظ الجدولة" : "حفظ الموعد"}
                    </button>
                    <button
                      onClick={() => setPendingAppointmentPrompt({ ...pendingAppointmentPrompt, step: 2 })}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-slate-700"
                    >
                      رجوع
                    </button>
                  </div>
                </>
              )}
              
            </div>
          </div>
        </div>
      )}

        {/* Mandatory Update Modal */}
        {updateState.isUpdating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95">
            <div className="bg-slate-900 p-10 rounded-3xl max-w-lg w-full text-center border-t border-blue-500 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <div
                  className={`text-4xl ${updateState.isReady ? "animate-bounce" : "animate-pulse"}`}
                >
                  🚀
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-4">
                تحديث إجباري للنظام
              </h2>

              {!updateState.isReady ? (
                <>
                  <p className="text-slate-400 mb-8 font-bold text-lg">
                    جاري تحميل إصدار جديد من الإدارة العليا. يرجى الانتظار...
                  </p>
                  <div className="w-full bg-slate-900 rounded-full h-4 mb-2 overflow-hidden border border-white/5">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${updateState.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-blue-400 font-extrabold text-2xl">
                    {updateState.progress}%
                  </p>
                </>
              ) : (
                <>
                  <p className="text-green-400 mb-8 font-bold text-lg">
                    تم اكتمل التحميل بنجاح! التطبيق جاهز الآن للتحديث وإعادة
                    التشغيل.
                  </p>
                  <button
                    onClick={handleInstallUpdate}
                    className="glow-button w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-extrabold rounded-2xl text-xl shadow-lg hover:scale-105 transition-all"
                  >
                    تحديث وإعادة تشغيل النظام
                  </button>
                </>
              )}
              {updateState.error && (
                <p className="text-red-400 mt-4 text-sm font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  {updateState.error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
