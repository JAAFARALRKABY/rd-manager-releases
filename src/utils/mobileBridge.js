/**
 * mobileBridge.js
 * Drop-in polyfill for Electron's ipcRenderer when running on Android (Capacitor) or Mobile Web.
 * Translates ipcRenderer.invoke(channel, payload) into HTTP calls to the RD Manager API server.
 */

const DEFAULT_API_HOST = "http://77.83.242.132:5000/api";

class MobileBridge {
  constructor() {
    this.listeners = new Map();
  }

  getApiBaseUrl() {
    try {
      const customHost = localStorage.getItem("rd_api_host");
      if (customHost && customHost.trim() !== "") {
        return customHost.trim().replace(/\/+$/, "") + "/api";
      }
    } catch (_) {}
    return DEFAULT_API_HOST;
  }

  async invoke(channel, payload = {}) {
    // Local / Client-side fast returns
    if (channel === "check-for-updates") {
      return { success: true, hasUpdate: false, message: "أحدث إصدار مثبت" };
    }

    if (channel === "get-db-settings") {
      return { serverIp: "77.83.242.132", dbName: "RD_FinancialDB" };
    }

    if (channel === "open-path" || channel === "open-backup-folder") {
      console.log(`[MobileBridge] ${channel} not applicable on mobile`);
      return { success: true };
    }

    const apiUrl = `${this.getApiBaseUrl()}/invoke`;

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ channel, payload }),
      });

      if (!response.ok) {
        throw new Error(`خطأ في استجابة الخادم: HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error(`[MobileBridge] Error invoking '${channel}':`, err);
      return {
        success: false,
        error: err.message || "تعذر الاتصال بخادم RD Enterprise",
      };
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return this;
  }

  removeListener(event, callback) {
    if (!this.listeners.has(event)) return this;
    const filtered = this.listeners.get(event).filter((cb) => cb !== callback);
    this.listeners.set(event, filtered);
    return this;
  }

  send(channel, ...args) {
    this.invoke(channel, args[0]).catch(() => {});
  }
}

export const mobileBridge = new MobileBridge();
