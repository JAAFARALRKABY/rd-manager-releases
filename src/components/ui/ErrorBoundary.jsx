import React from "react";
import { AlertOctagon, RefreshCcw } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("Enterprise System Error Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-screen w-full items-center justify-center bg-slate-950 p-6"
          dir="rtl"
        >
          <div className="bg-slate-900/80 backdrop-blur-3xl p-10 rounded-[2rem] border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] max-w-lg w-full text-center animate-fade-in relative overflow-hidden">
            <div className="absolute top-[-50%] right-[-10%] w-[50%] h-[100%] bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="w-24 h-24 mx-auto mb-6 bg-red-500/10 rounded-[2rem] flex items-center justify-center border border-red-500/20 shadow-inner">
              <AlertOctagon className="w-12 h-12 text-red-500 animate-pulse" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-4">
              عذراً، حدث خطأ غير متوقع
            </h1>
            <p className="text-slate-400 font-medium mb-8 leading-relaxed">
              لقد واجه النظام مشكلة فنية أثناء معالجة البيانات. تم تسجيل الخطأ
              في السجلات التقنية للعمل على حله. يرجى إعادة تحميل النظام لمتابعة
              العمل.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="glow-button w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:shadow-red-900/50 transition-all text-lg"
            >
              <RefreshCcw size={20} />
              إعادة تحميل النظام
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
