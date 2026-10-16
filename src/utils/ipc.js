/**
 * ipc.js — Shared IPC renderer accessor
 *
 * Provides a single, safe accessor for Electron's ipcRenderer.
 * Returns null when running outside of Electron (e.g. browser-only dev mode).
 * All components/hooks should import from here instead of calling
 * window.require("electron") directly, which prevents duplication and
 * makes the codebase easier to mock in tests.
 */

import { mobileBridge } from "./mobileBridge.js";

let _cached = null;

/**
 * Returns the Electron ipcRenderer singleton, or mobileBridge if running on Android/Mobile.
 * @returns {Electron.IpcRenderer | Object}
 */
export const getIpcRenderer = () => {
  if (_cached) return _cached;
  try {
    if (typeof window !== "undefined" && window.require) {
      _cached = window.require("electron").ipcRenderer;
    }
  } catch {
    _cached = null;
  }
  return _cached || mobileBridge;
};

