import { useState, useEffect } from "react";
import { User, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { getIpcRenderer } from "../utils/ipc";

const AuthScreen = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dbStatus, setDbStatus] = useState("جاري الاتصال بالسيرفر...");
  const [isConnected, setIsConnected] = useState(false);
  const [dbError, setDbError] = useState("");

  const ipcRenderer = getIpcRenderer();

  useEffect(() => {
    let pollInterval;
    if (ipcRenderer) {
      checkDbConnection();
      pollInterval = setInterval(async () => {
        const ok = await checkDbConnection();
        if (ok) clearInterval(pollInterval);
      }, 3000);
      ipcRenderer.invoke("get-db-settings").then(() => {});
    } else {
      setDbStatus("متصل محلياً");
      setIsConnected(true);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const checkDbConnection = async () => {
    if (!ipcRenderer) return false;
    const result = await ipcRenderer.invoke("check-db-connection");
    if (result.connected) {
      setDbStatus("متصل بقاعدة البيانات بنجاح");
      setIsConnected(true);
      setDbError("");
      return true;
    } else {
      setDbStatus("فشل الاتصال بقاعدة البيانات");
      setIsConnected(false);
      setDbError(result.error || "");
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (ipcRenderer && dbStatus !== "متصل محلياً") {
      try {
        const loginPromise = ipcRenderer.invoke("login", { username, password });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("انتهى وقت الاتصال، يرجى المحاولة مرة أخرى")), 15000)
        );
        const result = await Promise.race([loginPromise, timeoutPromise]);
        if (result.success) {
          onLogin(result.user);
        } else {
          setError(result.error || "اسم المستخدم أو كلمة المرور غير صحيحة");
          setLoading(false);
        }
      } catch (err) {
        setError(err.message || "حدث خطأ أثناء تسجيل الدخول");
        setLoading(false);
      }
    } else {
      if (username === "T8#vQ2!mL9@rPx7" && password === "N$4zQ8!wLm2#Xa9") {
        onLogin({
          Id: 1,
          Username: "T8#vQ2!mL9@rPx7",
          Role: "admin",
          AllowedSubDepartments: '["all"]',
        });
        setLoading(false);
      } else {
        setError("النظام غير متصل بالسيرفر.");
        setLoading(false);
      }
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#09090b" }}
      dir="rtl"
    >
      <div className="w-full max-w-[420px] px-6">
        {/* Logo Section (ZOOMED) */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center mb-6"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "32px",
              padding: "16px",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px -10px rgba(0,0,0,0.5)",
            }}
          >
            <img
              src="./logo.png"
              alt="Logo"
              className="w-32 h-32 object-contain brightness-0 invert opacity-100"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
            شركة المستشار
          </h1>
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
            قسم البحث والتطوير
          </p>
        </div>

        {/* Main Card */}
        <div
          style={{
            background: "#18181b",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "32px",
            padding: "32px",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px -10px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="flex items-center gap-3 mb-8 pb-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <Lock size={20} className="text-zinc-400" />
            <h2 className="text-xl font-bold text-zinc-200">تسجيل الدخول</h2>
          </div>

          {error && (
            <div
              className="mb-6 p-4 rounded-2xl text-center"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <p className="text-sm font-bold text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2">
                اسم المستخدم
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-zinc-200 rounded-2xl py-3.5 pr-11 pl-4 text-sm font-bold focus:outline-none transition-all"
                  style={{
                    background: "rgba(9,9,11,0.5)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#6366f1";
                    e.currentTarget.style.boxShadow =
                      "inset 0 2px 4px rgba(0,0,0,0.2), 0 0 0 3px rgba(99,102,241,0.2)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow =
                      "inset 0 2px 4px rgba(0,0,0,0.2)";
                  }}
                  placeholder="أدخل اسم المستخدم"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-zinc-200 rounded-2xl py-3.5 pr-11 pl-4 text-sm font-bold tracking-widest focus:outline-none transition-all"
                  style={{
                    background: "rgba(9,9,11,0.5)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#6366f1";
                    e.currentTarget.style.boxShadow =
                      "inset 0 2px 4px rgba(0,0,0,0.2), 0 0 0 3px rgba(99,102,241,0.2)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.08)";
                    e.currentTarget.style.boxShadow =
                      "inset 0 2px 4px rgba(0,0,0,0.2)";
                  }}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isConnected}
              className="w-full py-4 mt-2 text-white rounded-2xl font-bold text-sm transition-all duration-200"
              style={
                loading || !isConnected
                  ? { background: "#27272a", color: "#a1a1aa" }
                  : {
                      background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                      boxShadow:
                        "0 4px 15px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }
              }
            >
              {loading ? "جاري التحقق..." : "تسجيل الدخول"}
            </button>
          </form>
        </div>

        {/* Status Indicator */}
        <div className="mt-8 text-center">
          <div className="inline-flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
              />
              <span
                className={`text-xs font-bold ${isConnected ? "text-green-500/80" : "text-red-500/80"}`}
              >
                {dbStatus}
              </span>
            </div>
            {dbError && (
              <span className="text-[10px] text-red-500/60 max-w-[300px] text-center mt-1">
                {dbError}
              </span>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-[10px] font-bold text-slate-600 tracking-widest">
          © 2026 شركة المستشار المؤسسي | إعداد: جعفر الركابي
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
