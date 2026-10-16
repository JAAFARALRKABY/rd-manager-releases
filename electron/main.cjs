const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { connectDB, initializeTables } = require("./db.cjs");
const { getDbSettings, saveDbSettings } = require("./settings.cjs");

const { getDatabaseConfig } = require("./credentials.cjs");

// Import modular IPC handlers
const setupAuthHandlers = require("./ipc/auth.cjs");
const setupCrudHandlers = require("./ipc/crud.cjs");
const setupBackupHandlers = require("./ipc/backup.cjs");

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

let mainWindow;

function createWindow() {
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, "../public/logo.png"),
  });

  mainWindow.setMenu(null);

  // Navigation guard: prevent renderer from navigating away from the app
  mainWindow.webContents.on("will-navigate", (event, navUrl) => {
    const isDev = !app.isPackaged;
    const allowedOrigins = isDev
      ? ["http://localhost:5173"]
      : [`file://${path.join(__dirname, "../dist").replace(/\\/g, "/")}`];
    const allowed = allowedOrigins.some(origin => navUrl.startsWith(origin));
    if (!allowed) {
      event.preventDefault();
    }
  });

  // Block new-window creation from renderer (prevent window.open attacks)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Enable Refresh via Ctrl+R or F5, and Fullscreen via F11
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (
      (input.control && input.key.toLowerCase() === "r") ||
      input.key === "F5"
    ) {
      mainWindow.webContents.reload();
      event.preventDefault();
    } else if (input.key === "F11" && input.type === "keyDown") {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  // Start maximized
  mainWindow.maximize();

  ipcMain.handle("open-path", async (event, filepath) => {
    const { shell } = require("electron");
    try {
      if (!filepath || typeof filepath !== "string") {
        return { success: false, error: "Invalid path" };
      }
      const ext = path.extname(filepath).toLowerCase();
      const dangerousExtensions = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".msi", ".com", ".scr", ".jar", ".hta", ".wsf", ".cpl"];
      if (dangerousExtensions.includes(ext)) {
        return { success: false, error: "Execution of binary/script files is blocked" };
      }
      await shell.openPath(filepath);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

    // Auto Updater Setup (Only runs in production)
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", (info) => {
      if (mainWindow) mainWindow.webContents.send("update_available", info);
    });

    autoUpdater.on("download-progress", (progressObj) => {
      if (mainWindow)
        mainWindow.webContents.send("update_progress", progressObj.percent);
    });

    autoUpdater.on("update-downloaded", (info) => {
      if (mainWindow) mainWindow.webContents.send("update_downloaded", info);
    });

    autoUpdater.on("error", (err) => {
      if (mainWindow) mainWindow.webContents.send("update_error", err.message);
    });
  }
}

app.whenReady().then(async () => {
  createWindow();

  // Initialize all IPC handlers immediately so renderer can communicate right away
  setupAuthHandlers();
  setupCrudHandlers(mainWindow);
  setupBackupHandlers();

  // ─── Auto-connect to DB using secure credentials ───────────────────────────
  const enterpriseSettings = getDatabaseConfig(app);

  if (!enterpriseSettings || !enterpriseSettings.serverIp || !enterpriseSettings.dbPassword) {
    console.error("❌ خطأ: لم يتم العثور على بيانات الاتصال بقاعدة البيانات");
  } else {
    try {
      await connectDB(enterpriseSettings);
      await initializeTables();
      console.log("Successfully connected to Enterprise DB.");
    } catch (err) {
      console.error("Initial Enterprise DB connection failed:", err);
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Check for updates silently in the background
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(console.error);
    }, 5000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Root IPC Handlers (Settings)
ipcMain.handle("get-db-settings", () => {
  return getDbSettings();
});

ipcMain.handle("save-db-settings", async (event, settings) => {
  try {
    saveDbSettings(settings);
    await connectDB(settings);
    await initializeTables();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("check-db-connection", () => {
  const { getIsDbReady, getLastDbError } = require("./db.cjs");
  if (getIsDbReady()) return { connected: true };
  return {
    connected: false,
    error: getLastDbError() || "جاري الاتصال والتهيئة...",
  };
});

ipcMain.handle("quit-and-install", () => {
  // false = silent install, true = run after install
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle("check-for-updates", () => {
  if (!app.isPackaged)
    return { success: false, message: "لا يمكن فحص التحديثات في وضع المطور" };
  autoUpdater.checkForUpdatesAndNotify().catch(console.error);
  return {
    success: true,
    hasUpdate: false,
    message: "جاري البحث عن تحديثات عبر الخادم...",
  };
});

ipcMain.handle("download-update", async () => {
  if (!app.isPackaged) return { success: false, message: "لا يمكن التحميل في وضع المطور" };
  
  try {
    // Force the updater to think the current version is 0.0.0
    // so it ALWAYS triggers the normal update process!
    autoUpdater.currentVersion = require("semver").parse("0.0.0");
    autoUpdater.allowDowngrade = true;
    autoUpdater.autoDownload = false;
    
    const check = await autoUpdater.checkForUpdates();
    
    if (!check || !check.updateInfo) {
      return { success: false, message: "لم يتم العثور على معلومات التحديث." };
    }

    // Call the native downloader directly without checking versions!
    autoUpdater.downloadUpdate().catch(console.error);
    
    return { success: true, message: "بدأ التحميل السريع..." };
  } catch (err) {
    console.error(err);
    return { success: false, message: "حدث خطأ أثناء الاتصال بخادم التحديثات." };
  }
});

ipcMain.handle("get-app-lock-status", async () => {
  try {
    const { getPool, getIsDbReady } = require("./db.cjs");
    if (!getIsDbReady()) return { success: false, isLocked: false };
    
    const pool = getPool();
    if (!pool) return { success: false, isLocked: false };

    const request = pool.request();
    const result = await request.query("SELECT Value FROM SystemSettings WHERE KeyName = 'AppLocked'");
    if (result.recordset.length > 0) {
      return { success: true, isLocked: result.recordset[0].Value === 'true' };
    }
    return { success: false, isLocked: false };
  } catch (err) {
    return { success: false, isLocked: false };
  }
});

ipcMain.handle("toggle-app-lock", async (event, isLocked) => {
  try {
    const { getPool } = require("./db.cjs");
    const pool = getPool();
    if (!pool) return { success: false, error: "Database not connected" };

    const request = pool.request();
    await request.query(`
      UPDATE SystemSettings 
      SET Value = '${isLocked ? 'true' : 'false'}' 
      WHERE KeyName = 'AppLocked'
    `);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
