const { ipcMain, app } = require("electron");
const { getPool } = require("../db.cjs");
const fs = require("fs");
const path = require("path");

// Ensure Backup Directory Exists
const BACKUP_DIR = path.join(app.getPath("documents"), "RD_Backups");
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Core Backup Function
const performBackup = async (triggerType = "Manual", userId = null) => {
  try {
    const pool = getPool();
    if (!pool) throw new Error("Database not connected");

    const tables = [
      "Users",
      "Departments",
      "SubDepartments",
      "Records",
      "Files",
      "ActivityLogs",
      "Requests",
    ];
    const backupData = {
      timestamp: new Date().toISOString(),
      trigger: triggerType,
      data: {},
    };

    for (let table of tables) {
      const res = await pool.request().query(`SELECT * FROM ${table}`);
      backupData.data[table] = res.recordset;
    }

    const dateStr = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const fileName = `RD_Backup_${dateStr}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);

    // Delete all old backup files to keep only the latest ONE
    const existingFiles = fs.readdirSync(BACKUP_DIR);
    for (const file of existingFiles) {
      if (file.startsWith("RD_Backup_") && file.endsWith(".json")) {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

    // Log it if manual
    if (userId) {
      const logReq = pool.request();
      logReq.input("userId", userId);
      logReq.input("details", JSON.stringify({ type: triggerType, file: fileName }));
      logReq.input("sysCreatedAt", new Date());
      await logReq.query(`
                INSERT INTO ActivityLogs (UserId, Action, Details, CreatedAt)
                VALUES (@userId, 'backup', @details, @sysCreatedAt)
            `);
    }

    return { success: true, path: filePath, fileName: fileName };
  } catch (err) {
    console.error("Backup failed:", err);
    return { success: false, error: err.message };
  }
};

module.exports = function setupBackupHandlers() {
  ipcMain.handle("take-backup", async (event, { userId }) => {
    const authService = require("../services/AuthorizationService.cjs");
    const pool = getPool();
    if (!pool) return { success: false, error: "Database not connected" };
    
    if (!userId) return { success: false, error: "Unauthorized" };
    const currentUser = await pool.request().input("uid", userId).query("SELECT * FROM Users WHERE Id = @uid").then(r => r.recordset[0]);
    if (!currentUser || !authService.hasRole(currentUser, authService.ROLES.ADMIN)) {
       return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };
    }
    
    return await performBackup("Manual", userId);
  });

  ipcMain.handle("open-backup-folder", async () => {
    const { shell } = require("electron");
    shell.openPath(BACKUP_DIR);
    return { success: true };
  });
};
