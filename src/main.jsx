import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";

import { mobileBridge } from "./utils/mobileBridge.js";

// Polyfill window.require on mobile/web so any direct window.require('electron') calls work seamlessly
if (typeof window !== "undefined" && !window.require) {
  window.require = function (moduleName) {
    if (moduleName === "electron") {
      return {
        ipcRenderer: mobileBridge,
        shell: {
          openPath: async () => ({ success: true }),
        },
      };
    }
    return {};
  };
}

// ─── Global crash reporters ───────────────────────────────────────────────────
// Writes to crash-report.txt via Electron's node integration.
const writeCrash = (message) => {
  try {
    if (window.require) {
      const fs = window.require("fs");
      fs.appendFileSync("crash-report.txt", message + "\n");
    }
  } catch (_) {}
};

window.addEventListener("error", (event) => {
  writeCrash("Global Error: " + (event.error?.stack ?? event.message));
});

// Also catch unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  writeCrash(
    "Unhandled Promise Rejection: " +
      (event.reason?.stack ?? String(event.reason)),
  );
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
