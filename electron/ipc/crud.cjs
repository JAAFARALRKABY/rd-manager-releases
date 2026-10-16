const { ipcMain, app, Notification } = require("electron");
const { getPool } = require("../db.cjs");
const fs = require("fs");
const path = require("path");

// Configure upload directory
const UPLOAD_DIR = path.join(app.getPath("userData"), "RD_Files");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const TABLES = {
  users: "Users",
  departments: "Departments",
  subdepartments: "SubDepartments",
  records: "Records",
  files: "Files",
  activitylogs: "ActivityLogs",
  requests: "Requests",
  contacts: "Contacts",
  customcategories: "CustomCategories",
};

const ALLOWED_COLUMNS = {
  Users: [
    "Username",
    "FullName",
    "PasswordHash",
    "Role",
    "AllowedSubDepartments",
    "CallManagerSubs",
    "IsActive",
  ],
  Departments: ["Name", "SortOrder"],
  CustomCategories: ["Name", "SubDepartmentId"],
  SubDepartments: ["DepartmentId", "Name"],
  Records: ["SubDepartmentId", "CreatedBy_UserId", "SearchIndex", "Content"],
  Files: [
    "RecordId",
    "FilePath",
    "FileType",
    "FileSize",
    "IsDeleted",
    "DeletedAt",
    "FileData",
  ],
  ActivityLogs: [
    "UserId",
    "Action",
    "TargetTable",
    "TargetId",
    "Details",
    "IPAddress",
  ],
  Requests: [
    "CreatedBy_UserId",
    "SubDepartmentId",
    "DepartmentId",
    "Title",
    "Content",
    "Status",
  ],
};

async function logActivity(
  request,
  userId,
  action,
  targetTable,
  targetId,
  details = null,
) {
  if (!userId) return;
  request.input("logUserId", userId);
  request.input("logTargetId", targetId);
  request.input("logAction", action);
  request.input("logDetails", details ? JSON.stringify(details) : null);
  request.input("logSysCreatedAt", new Date());
  request.input("logTargetTable", targetTable);
  await request.query(`
        INSERT INTO ActivityLogs (UserId, Action, TargetTable, TargetId, Details, CreatedAt)
        VALUES (@logUserId, @logAction, @logTargetTable, @logTargetId, @logDetails, @logSysCreatedAt)
    `);
}

async function fetchCurrentUser(pool, userId) {
  if (!userId) return null;
  const res = await pool.request().input("uid", userId).query("SELECT * FROM Users WHERE Id = @uid");
  return res.recordset[0] || null;
}

let cleanupInterval = null;
let reminderInterval = null;
let tempCleanupInterval = null;

module.exports = function setupCrudHandlers(mainWindow) {
  if (cleanupInterval) clearInterval(cleanupInterval);
  if (reminderInterval) clearInterval(reminderInterval);
  if (tempCleanupInterval) clearInterval(tempCleanupInterval);

  // 1. Generic Fetch
  ipcMain.handle(
    "get-table-data",
    async (event, { table, currentUser, filters = null }) => {
      const authService = require("../services/AuthorizationService.cjs");
      try {
        const pool = getPool();
        if (!pool) return { success: false, error: "DB Disconnected" };
        const safeTable = TABLES[table.toLowerCase()];
        if (!safeTable) return { success: false, error: "Invalid table" };

        let query = `SELECT * FROM ${safeTable}`;
        if (safeTable === "Files") {
          query = `SELECT Id, RecordId, FilePath, FileType, FileSize, CreatedAt, IsDeleted FROM Files`;
        }

        const request = pool.request();
        const conditions = [];

        if (safeTable === "Users") {
          conditions.push(`(IsActive = 1 OR IsActive IS NULL)`);
        }

        // Role-based visibility using AuthorizationService
        if ((safeTable === "Records" || safeTable === "Requests") && currentUser) {
          if (authService.hasRole(currentUser, authService.ROLES.EMPLOYEE)) {
            request.input("currUserId", currentUser.Id);
            if (safeTable === "Records") {
              const callManagerSubs = await authService.getCallManagerSubDepartments(currentUser);
              let callManagerCondition = "";
              if (callManagerSubs && callManagerSubs.length > 0) {
                 const callParamNames = callManagerSubs.map((_, i) => `@callSub${i}`);
                 callManagerSubs.forEach((sub, i) => request.input(`callSub${i}`, sub));
                 callManagerCondition = ` OR SubDepartmentId IN (${callParamNames.join(', ')}) OR SubDepartmentId IN (SELECT Id FROM SubDepartments WHERE (Name LIKE N'%مطلوب%' OR Name LIKE N'%متابعة%' OR Name LIKE N'%اتصال%' OR Name LIKE N'%مواعيد%') AND Name NOT LIKE N'%عملاء%')`;
              } else {
                 callManagerCondition = ` OR SubDepartmentId IN (SELECT Id FROM SubDepartments WHERE Name LIKE N'%مطلوب%' AND Name LIKE N'%اتصال%')`;
              }
              conditions.push(`(CreatedBy_UserId = @currUserId ${callManagerCondition})`);
            } else {
              conditions.push(`CreatedBy_UserId = @currUserId`);
            }
          } else if (!authService.hasRole(currentUser, authService.ROLES.ADMIN) && !authService.hasRole(currentUser, authService.ROLES.ASSISTANT)) {
            const allowedSubs = await authService.getAllowedSubDepartmentIds(currentUser);
            if (allowedSubs !== 'all') {
              if (allowedSubs.length > 0) {
                const paramNames = allowedSubs.map((_, i) => `@allowedSub${i}`);
                allowedSubs.forEach((sub, i) => request.input(`allowedSub${i}`, sub));
                conditions.push(`SubDepartmentId IN (${paramNames.join(', ')})`);
              } else {
                conditions.push(`1 = 0`); // Deny
              }
            }
          }
        } else if (safeTable === "SubDepartments" && currentUser) {
          if (!authService.hasRole(currentUser, authService.ROLES.ADMIN) && !authService.hasRole(currentUser, authService.ROLES.ASSISTANT)) {
            const allowedSubs = await authService.getAllowedSubDepartmentIds(currentUser);
            if (allowedSubs !== 'all') {
              if (allowedSubs.length > 0) {
                const paramNames = allowedSubs.map((_, i) => `@subAllowed${i}`);
                allowedSubs.forEach((sub, i) => request.input(`subAllowed${i}`, sub));
                conditions.push(`Id IN (${paramNames.join(', ')})`);
              } else {
                conditions.push(`1 = 0`);
              }
            }
          }
        } else if (safeTable === "Departments" && currentUser) {
          if (!authService.hasRole(currentUser, authService.ROLES.ADMIN) && !authService.hasRole(currentUser, authService.ROLES.ASSISTANT)) {
            const allowedSubs = await authService.getAllowedSubDepartmentIds(currentUser);
            if (allowedSubs !== 'all') {
              if (allowedSubs.length > 0) {
                const paramNames = allowedSubs.map((_, i) => `@depSubAllowed${i}`);
                allowedSubs.forEach((sub, i) => request.input(`depSubAllowed${i}`, sub));
                conditions.push(`Id IN (SELECT DepartmentId FROM SubDepartments WHERE Id IN (${paramNames.join(', ')}))`);
              } else {
                conditions.push(`1 = 0`);
              }
            }
          }
        } else if (safeTable === "Users" && currentUser) {
           if (authService.hasRole(currentUser, authService.ROLES.DEPARTMENT_MANAGER)) {
              // Only show users whose AllowedSubDepartments overlap with the manager's managed sub-departments
              const managedSubs = await authService.getAllowedSubDepartmentIds(currentUser);
              if (managedSubs !== 'all' && managedSubs.length > 0) {
                 // Build a subquery: include users who have any of these sub-department IDs in their AllowedSubDepartments JSON
                 // We fetch all and let JS filter - safer than JSON parsing in SQL
                 // Add manager's own exclusion in JS (done in frontend)
                 // For backend filtering, we just ensure managedSubs are available
                 // We'll do a rough filter: show users whose AllowedSubDepartments is NOT empty and NOT 'all'
                 // and whose sub-departments intersect. Since SQL can't parse JSON easily, we'll rely on frontend JS
                 // BUT we prevent returning admins:
                 conditions.push(`Role != 'admin'`);
              } else if (managedSubs.length === 0) {
                 conditions.push(`1 = 0`); // No managed subs = see nothing
              }
           }
        }

        if (conditions.length > 0) {
          query += ` WHERE ` + conditions.join(" AND ");
        }

        const result = await request.query(query);
        const data = result.recordset;

        if (safeTable === "Users") {
            const cmRes = await pool.request().query("SELECT UserId, SubDepartmentId FROM CallManagers");
            const cmMap = {};
            for (const row of cmRes.recordset) {
                if (!cmMap[row.UserId]) cmMap[row.UserId] = [];
                cmMap[row.UserId].push(row.SubDepartmentId.toString());
            }
            for (let u of data) {
                u.CallManagerSubs = JSON.stringify(cmMap[u.Id] || []);
            }
        }

        return { success: true, data: data };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle("get-call-managers", async (event) => {
    try {
      const pool = getPool();
      if (!pool) return { success: false, error: "DB Disconnected" };
      const result = await pool.request().query("SELECT UserId, SubDepartmentId FROM CallManagers");
      const mapped = {};
      for (const row of result.recordset) {
        if (!mapped[row.UserId]) mapped[row.UserId] = [];
        mapped[row.UserId].push(row.SubDepartmentId.toString());
      }
      return { success: true, data: mapped };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("save-call-managers", async (event, { userId, subDepartmentIds, adminId }) => {
    try {
      const authService = require("../services/AuthorizationService.cjs");
      const pool = getPool();
      if (!pool) return { success: false, error: "DB Disconnected" };

      const admin = await pool.request().input("uid", adminId).query("SELECT * FROM Users WHERE Id = @uid").then(r => r.recordset[0]);
      if (!admin || (!authService.hasRole(admin, authService.ROLES.ADMIN) && !authService.hasRole(admin, authService.ROLES.ASSISTANT))) {
        return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };
      }

      const request = pool.request();
      request.input("userId", userId);
      
      const transaction = new (require("mssql")).Transaction(pool);
      await transaction.begin();

      try {
         const txReq = transaction.request();
         txReq.input("userId", userId);
         await txReq.query(`DELETE FROM CallManagers WHERE UserId = @userId`);
         
         for (const subId of subDepartmentIds) {
            const iReq = transaction.request();
            iReq.input("userId", userId);
            iReq.input("subId", subId);
            await iReq.query(`INSERT INTO CallManagers (UserId, SubDepartmentId) VALUES (@userId, @subId)`);
         }

         await transaction.commit();
         authService.invalidateCache(userId);
         return { success: true };
      } catch (txErr) {
         await transaction.rollback();
         return { success: false, error: txErr.message };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 2. Generic Add
  ipcMain.handle("add-record", async (event, { table, data, userId }) => {
    try {
      const authService = require("../services/AuthorizationService.cjs");
      const pool = getPool();
      if (!pool) return { success: false, error: "DB Disconnected" };
      const safeTable = TABLES[table.toLowerCase()];
      if (!safeTable) return { success: false, error: "Invalid table" };

      const currentUser = await fetchCurrentUser(pool, userId);
      if (!currentUser) return { success: false, error: "User not found" };

      // Authorization Check
      if (safeTable === "Users") {
        const canCreate = await authService.canCreateUser(currentUser, data.Role, data.AllowedSubDepartments ? JSON.parse(data.AllowedSubDepartments) : []);
        if (!canCreate) return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };
      } else if (safeTable === "Records") {
        const subDeptId = data.SubDepartmentId;
        const hasAccess = await authService.hasDepartmentAccess(currentUser, subDeptId);
        if (!hasAccess) return { success: false, error: authService.ERRORS.ERR_DEPARTMENT_ACCESS_DENIED };
      }

      const sql = require("mssql");
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = transaction.request();
        const validColumns = ALLOWED_COLUMNS[safeTable] || [];
        const keysArr = Object.keys(data).filter((k) =>
          validColumns.includes(k),
        );

        const keys = keysArr.join(", ") + ", CreatedAt";
        const valuesArr = keysArr.map((k, i) => {
          request.input(`p${i}`, data[k] === null ? null : data[k]);
          return `@p${i}`;
        });
        const values = valuesArr.join(", ") + ", @sysCreatedAt";

        request.input("sysCreatedAt", new Date());

        const result = await request.query(`
                    INSERT INTO ${safeTable} (${keys}) 
                    OUTPUT inserted.Id
                    VALUES (${values})
                `);

        const newId = result.recordset[0].Id;

        // Log it
        await logActivity(request, userId, "add", safeTable, newId);

        await transaction.commit();
        return { success: true, id: newId };
      } catch (txErr) {
        await transaction.rollback();
        throw txErr;
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 3. Generic Update
  ipcMain.handle(
    "update-record",
    async (event, { table, id, data, userId }) => {
      try {
        const authService = require("../services/AuthorizationService.cjs");
        const pool = getPool();
        if (!pool) return { success: false, error: "DB Disconnected" };
        const safeTable = TABLES[table.toLowerCase()];
        if (!safeTable) return { success: false, error: "Invalid table" };

        const currentUser = userId ? await fetchCurrentUser(pool, userId) : null;

        // Authorization Check: Fetch target first
        const targetRes = await pool.request().input("targetId", id).query(`SELECT * FROM ${safeTable} WHERE Id = @targetId`);
        const targetRecord = targetRes.recordset[0];
        if (!targetRecord) return { success: false, error: "Record not found" };

        if (currentUser) {
          if (safeTable === "Users") {
            const canEdit = await authService.canEditUser(currentUser, targetRecord);
            if (!canEdit) return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };
          } else if (safeTable === "Records") {
            const canEdit = await authService.canEditRecord(currentUser, targetRecord);
            if (!canEdit) return { success: false, error: authService.ERRORS.ERR_DEPARTMENT_ACCESS_DENIED };
          } else if (safeTable === "Requests") {
            const isAdmin = authService.hasRole(currentUser, authService.ROLES.ADMIN) || authService.hasRole(currentUser, authService.ROLES.ASSISTANT);
            const isCreator = targetRecord.CreatedBy_UserId === currentUser.Id;
            if (!isAdmin && !isCreator) return { success: false, error: authService.ERRORS.ERR_DEPARTMENT_ACCESS_DENIED };
          }
        }

        const sql = require("mssql");
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
          const request = transaction.request();
          const validColumns = ALLOWED_COLUMNS[safeTable] || [];
          const updatesArr = Object.keys(data)
            .filter((k) => validColumns.includes(k))
            .map((k, i) => {
              request.input(`p${i}`, data[k] === null ? null : data[k]);
              return `${k} = @p${i}`;
            });

          if (updatesArr.length === 0)
            throw new Error("No valid columns to update");

          const updates = updatesArr.join(", ");
          request.input("id", id);

          await request.query(
            `UPDATE ${safeTable} SET ${updates} WHERE Id = @id`,
          );

          // Log it
          await logActivity(request, userId, "edit", safeTable, id);

          await transaction.commit();
          return { success: true };
        } catch (txErr) {
          await transaction.rollback();
          throw txErr;
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );

  // 4. Generic Delete
  ipcMain.handle("delete-record", async (event, { table, id, userId }) => {
    try {
      const authService = require("../services/AuthorizationService.cjs");
      const pool = getPool();
      if (!pool) return { success: false, error: "DB Disconnected" };
      const safeTable = TABLES[table.toLowerCase()];
      if (!safeTable) return { success: false, error: "Invalid table" };

      const currentUser = await fetchCurrentUser(pool, userId);
      if (!currentUser) return { success: false, error: "User not found" };

      // Authorization Check: Fetch target first
      const targetRes = await pool.request().input("targetId", id).query(`SELECT * FROM ${safeTable} WHERE Id = @targetId`);
      const targetRecord = targetRes.recordset[0];
      if (!targetRecord) return { success: false, error: "Record not found" };

      if (safeTable === "Users") {
        const canDelete = await authService.canDeleteUser(currentUser, targetRecord);
        if (!canDelete) return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };
      } else if (safeTable === "Records") {
        const canDelete = await authService.canDeleteRecord(currentUser, targetRecord);
        if (!canDelete) return { success: false, error: authService.ERRORS.ERR_DEPARTMENT_ACCESS_DENIED };
      } else if (safeTable === "Requests") {
        const isAdmin = authService.hasRole(currentUser, authService.ROLES.ADMIN) || authService.hasRole(currentUser, authService.ROLES.ASSISTANT);
        const isCreator = targetRecord.CreatedBy_UserId === currentUser.Id;
        if (!isAdmin && !isCreator) return { success: false, error: authService.ERRORS.ERR_DEPARTMENT_ACCESS_DENIED };
      }

      const sql = require("mssql");
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = transaction.request();
        request.input("id", id);

        if (safeTable === "Users") {
          await request.query(`DELETE FROM ActivityLogs WHERE UserId = @id`);
        }

        await request.query(`DELETE FROM ${safeTable} WHERE Id = @id`);

        // Log it
        await logActivity(request, userId, "delete", safeTable, id);

        await transaction.commit();
        return { success: true };
      } catch (txErr) {
        await transaction.rollback();
        throw txErr;
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 5. File Upload Handler
  ipcMain.handle(
    "upload-file",
    async (event, { fileData, fileName, fileType, recordId, userId }) => {
      try {
        const authService = require("../services/AuthorizationService.cjs");
        const pool = getPool();
        if (!pool) return { success: false, error: "DB Disconnected" };

        const currentUser = await fetchCurrentUser(pool, userId);
        if (!currentUser) return { success: false, error: "User not found" };

        if (recordId) {
          const targetRes = await pool.request().input("recId", recordId).query(`SELECT * FROM Records WHERE Id = @recId`);
          const targetRecord = targetRes.recordset[0];
          if (!targetRecord) return { success: false, error: "Record not found" };
          const canUpload = await authService.canEditRecord(currentUser, targetRecord);
          if (!canUpload) return { success: false, error: authService.ERRORS.ERR_DEPARTMENT_ACCESS_DENIED };
        }

        // fileData is expected to be a base64 string or buffer from the frontend
        const base64Content = fileData.split(",")[1] || fileData;
        if (base64Content.length * 0.75 > 50 * 1024 * 1024) {
          return {
            success: false,
            error: "الملف كبير جداً (أقصى حد 50 ميجابايت)",
          };
        }

        const buffer = Buffer.from(base64Content, "base64");
        const fileSize = buffer.length;
        if (fileSize > 50 * 1024 * 1024) {
          return {
            success: false,
            error: "الملف كبير جداً (أقصى حد 50 ميجابايت)",
          };
        }

        const sanitizedFileName = path.basename(fileName);
        const uniqueName = Date.now() + "_" + sanitizedFileName;
        const fullPath = path.join(UPLOAD_DIR, uniqueName);

        // Keep local save as backup
        await fs.promises.writeFile(fullPath, buffer);

        const sql = require("mssql");
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
          const request = transaction.request();
          request.input("recordId", recordId ? recordId : null);
          request.input("fullPath", fullPath);
          request.input("fileType", fileType);
          request.input("fileSize", fileSize);
          request.input("fileData", buffer);
          request.input("sysCreatedAt", new Date());

          const result = await request.query(`
                    INSERT INTO Files (RecordId, FilePath, FileType, FileSize, FileData, CreatedAt)
                    OUTPUT inserted.Id
                    VALUES (@recordId, @fullPath, @fileType, @fileSize, @fileData, @sysCreatedAt)
                `);

          const newId = result.recordset[0].Id;

          // Log it
          await logActivity(request, userId, "upload", "Files", newId, {
            fileName,
          });

          await transaction.commit();
          return { success: true, id: newId, path: fullPath };
        } catch (txErr) {
          await transaction.rollback();
          await fs.promises.unlink(fullPath).catch(() => {});
          throw txErr;
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );

  // 5.5 Open File Handler
  ipcMain.handle("open-file", async (event, fileId, fallbackPath) => {
    try {
      const pool = getPool();
      let hasFileData = false;
      if (pool) {
        const res = await pool
          .request()
          .input("id", fileId)
          .query("SELECT FileData, FilePath FROM Files WHERE Id = @id");
        if (res.recordset.length > 0) {
          const row = res.recordset[0];
          if (row.FileData) {
            hasFileData = true;
            const tempDir = path.join(app.getPath("temp"), "rd_temp_downloads");
            try {
              await fs.promises.mkdir(tempDir, { recursive: true });
            } catch (e) {}
            const tempPath = path.join(
              tempDir,
              "RD_" + Date.now() + "_" + path.basename(row.FilePath),
            );
            await fs.promises.writeFile(tempPath, row.FileData);
            const { shell } = require("electron");
            const err = await shell.openPath(tempPath);
            if (err) return { success: false, error: err };
            return { success: true };
          }
        }
      }
      // Fallback for legacy files
      if (!hasFileData) {
        try {
          await fs.promises.access(fallbackPath, fs.constants.F_OK);
          const { shell } = require("electron");
          const err = await shell.openPath(fallbackPath);
          if (err) return { success: false, error: err };
          return { success: true };
        } catch {
          return {
            success: false,
            error:
              "الملف غير موجود في المسار القديم. ربما تم حذفه أو رفعه من حاسوب آخر.",
          };
        }
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 6. Soft Delete File
  ipcMain.handle("delete-file", async (event, { fileId, userId }) => {
    try {
      const authService = require("../services/AuthorizationService.cjs");
      const pool = getPool();
      if (!pool) return { success: false, error: "DB Disconnected" };

      const currentUser = await fetchCurrentUser(pool, userId);
      if (!currentUser) return { success: false, error: "User not found" };

      const targetRes = await pool.request().input("fileId", fileId).query(`
          SELECT f.*, r.SubDepartmentId 
          FROM Files f 
          LEFT JOIN Records r ON f.RecordId = r.Id 
          WHERE f.Id = @fileId
      `);
      const targetFile = targetRes.recordset[0];
      if (!targetFile) return { success: false, error: "File not found" };

      if (targetFile.RecordId) {
          const canDelete = await authService.canEditRecord(currentUser, { SubDepartmentId: targetFile.SubDepartmentId });
          if (!canDelete) return { success: false, error: authService.ERRORS.ERR_DEPARTMENT_ACCESS_DENIED };
      }

      const request = pool.request();
      request.input("fileId", fileId);
      request.input("sysDeletedAt", new Date());
      await request.query(
        `UPDATE Files SET IsDeleted = 1, DeletedAt = @sysDeletedAt WHERE Id = @fileId`,
      );

      if (userId) {
        const logReq = pool.request();
        logReq.input("userId", userId);
        logReq.input("targetId", fileId);
        logReq.input("action", "delete_file");
        logReq.input("sysCreatedAt", new Date());
        await logReq.query(`
                    INSERT INTO ActivityLogs (UserId, Action, TargetTable, TargetId, CreatedAt)
                    VALUES (@userId, @action, 'Files', @targetId, @sysCreatedAt)
                `);
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 7. Clear all logs
  ipcMain.handle("clear-logs", async (event, { userId }) => {
    try {
      const authService = require("../services/AuthorizationService.cjs");
      const pool = getPool();
      if (!pool) return { success: false, error: "DB Disconnected" };

      const currentUser = await fetchCurrentUser(pool, userId);
      if (!currentUser || (!authService.hasRole(currentUser, authService.ROLES.ADMIN) && !authService.hasRole(currentUser, authService.ROLES.ASSISTANT))) {
        return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };
      }

      await pool.request().query(`TRUNCATE TABLE ActivityLogs`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 10. Open External URL (protocol-whitelist to prevent RCE via file:// or custom schemes)
  ipcMain.handle("open-external-url", async (event, url) => {
    try {
      if (typeof url !== "string") return { success: false, error: "Invalid URL" };
      const allowedProtocols = ["http:", "https:"];
      let parsed;
      try { parsed = new URL(url); } catch { return { success: false, error: "Malformed URL" }; }
      if (!allowedProtocols.includes(parsed.protocol)) {
        return { success: false, error: "Protocol not allowed" };
      }
      const { shell } = require("electron");
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 11. Simulate Enter Key (Legacy)
  ipcMain.handle("simulate-enter", async () => {
    try {
      const { exec } = require("child_process");
      exec(
        `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"`,
        (error) => {
          if (error) console.error("Simulate enter error:", error);
        },
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 12. Simulate WhatsApp Send (with optional attachments)
  ipcMain.handle("simulate-whatsapp-send", async (event, filePaths = []) => {
    try {
      const { exec } = require("child_process");
      const fs = require("fs");
      const path = require("path");
      const { app } = require("electron");

      // 1. Send Enter key directly to the active window (WhatsApp chat)
      // Using windowsHide to prevent focus stealing.
      const psCommand = `Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 1000; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -Milliseconds 500; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')`;

      exec(`powershell -Command "${psCommand}"`, { windowsHide: true });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 13. Download temp file from URL (for Drag & Drop from browser)
  ipcMain.handle("download-temp-file", async (event, url) => {
    try {
      if (typeof url !== "string") return { success: false, error: "Invalid URL" };
      if (!url.startsWith("data:") && !url.startsWith("http://") && !url.startsWith("https://")) {
        return { success: false, error: "URL scheme not allowed" };
      }
      const { app } = require("electron");
      const path = require("path");
      const fs = require("fs");
      const https = require("https");
      const http = require("http");

      const tempDir = path.join(app.getPath("temp"), "rd_temp_downloads");
      try {
        await fs.promises.mkdir(tempDir, { recursive: true });
      } catch (e) {}

      // Handle base64 dragging if it happens
      if (url.startsWith("data:")) {
        const matches = url.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3)
          throw new Error("Invalid base64 format");
        const ext = matches[1].split("/")[1] || "jpg";
        const fileName = `temp_${Date.now()}.${ext.replace(/[^a-zA-Z0-9]/g, "")}`;
        const filePath = path.join(tempDir, fileName);
        await fs.promises.writeFile(
          filePath,
          Buffer.from(matches[2], "base64"),
        );
        return {
          success: true,
          path: filePath,
          name: fileName,
          type: matches[1],
        };
      }

      // Validate URL and prevent SSRF to local/intranet networks
      const parsedUrl = new URL(url);
      const host = (parsedUrl.hostname || "").toLowerCase();
      const isPrivate = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0"
        || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
        || /^169\.254\./.test(host);

      if (isPrivate) {
        return { success: false, error: "Access to private/internal network addresses is prohibited" };
      }

      let ext = path.extname(parsedUrl.pathname) || ".jpg";
      const dangerousExtensions = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".msi", ".com", ".scr", ".jar", ".hta", ".sh"];
      if (dangerousExtensions.includes(ext.toLowerCase())) {
        ext = ".bin";
      }

      const fileName = `temp_${Date.now()}${ext}`;
      const filePath = path.join(tempDir, fileName);

      const file = fs.createWriteStream(filePath);
      const client = parsedUrl.protocol === "https:" ? https : http;
      const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50MB
      let downloadedBytes = 0;

      await new Promise((resolve, reject) => {
        const req = client.get(parsedUrl, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            file.close();
            fs.promises.unlink(filePath).catch(() => {});
            return reject(new Error("Redirects not allowed for temp downloads"));
          }

          if (response.statusCode !== 200) {
            file.close();
            fs.promises.unlink(filePath).catch(() => {});
            return reject(new Error(`Download failed with status ${response.statusCode}`));
          }

          response.on("data", (chunk) => {
            downloadedBytes += chunk.length;
            if (downloadedBytes > MAX_DOWNLOAD_BYTES) {
              response.destroy();
              file.close();
              fs.promises.unlink(filePath).catch(() => {});
              reject(new Error("File exceeds 50MB size limit"));
            }
          });

          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve);
          });
        });

        req.on("error", (err) => {
          file.close();
          fs.promises.unlink(filePath).catch(() => {});
          reject(err);
        });
      });

      return { success: true, path: filePath, name: fileName };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 14. Save temp blob from pasted files
  ipcMain.handle(
    "save-temp-blob",
    async (event, base64Data, originalName, mimeType) => {
      try {
        const { app } = require("electron");
        const path = require("path");
        const fs = require("fs");

        const tempDir = path.join(app.getPath("temp"), "rd_temp_downloads");
        try {
          await fs.promises.mkdir(tempDir, { recursive: true });
        } catch (e) {}

        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3)
          throw new Error("Invalid base64 format");

        const ext = mimeType.split("/")[1] || "jpg";
        const rawName = originalName || `paste_${Date.now()}.${ext}`;
        const fileName = path.basename(rawName); // sanitize against path traversal
        const filePath = path.join(tempDir, `temp_${Date.now()}_${fileName}`);

        await fs.promises.writeFile(
          filePath,
          Buffer.from(matches[2], "base64"),
        );

        return {
          success: true,
          path: filePath,
          name: fileName,
          type: mimeType,
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );

  // ── Reorder Departments ──────────────────────────────────────────────────
  ipcMain.handle("reorder-departments", async (event, { orders, userId }) => {
    // orders = [{ id, sortOrder }, ...]
    try {
      const authService = require("../services/AuthorizationService.cjs");
      const pool = getPool();
      if (!pool) return { success: false, error: "DB Disconnected" };

      const currentUser = await fetchCurrentUser(pool, userId);
      if (!currentUser || (!authService.hasRole(currentUser, authService.ROLES.ADMIN) && !authService.hasRole(currentUser, authService.ROLES.ASSISTANT))) {
        return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };
      }

      // Idempotent: ensure SortOrder column exists
      try {
        await pool.request().query(`
          IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME='Departments' AND COLUMN_NAME='SortOrder'
          )
          ALTER TABLE Departments ADD SortOrder INT DEFAULT 0
        `);
      } catch (e) { /* column already exists */ }

      for (const { id, sortOrder } of orders) {
        await pool.request()
          .input("sid", sortOrder)
          .input("did", id)
          .query("UPDATE Departments SET SortOrder = @sid WHERE Id = @did");
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Ensure SortOrder column exists at startup ─────────────────────────────
  (async () => {
    try {
      const pool = getPool();
      if (!pool) return;
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME='Departments' AND COLUMN_NAME='SortOrder'
        )
        ALTER TABLE Departments ADD SortOrder INT DEFAULT 0
      `);
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME='Requests' AND COLUMN_NAME='DepartmentId'
        )
        ALTER TABLE Requests ADD DepartmentId INT NULL
      `);
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME='CustomCategories' AND COLUMN_NAME='SubDepartmentId'
        )
        ALTER TABLE CustomCategories ADD SubDepartmentId INT NULL
      `);
    } catch (e) {}
  })();

  // 8. Cron Job for hard deleting old files
  const cleanupOldFiles = async () => {
    try {
      const pool = getPool();
      if (!pool) return;
      const result = await pool.request().query(`
                SELECT Id, FilePath FROM Files 
                WHERE IsDeleted = 1 AND DeletedAt < DATEADD(day, -1, GETDATE())
            `);

      const fs = require("fs");
      for (let row of result.recordset) {
        try {
          await fs.promises.access(row.FilePath, fs.constants.F_OK);
          await fs.promises.unlink(row.FilePath);
        } catch (e) {}

        try {
          const delReq = pool.request();
          delReq.input("fileId", row.Id);
          await delReq.query(`DELETE FROM Files WHERE Id = @fileId`);
        } catch (e) {
          console.error("Failed to hard delete file:", e);
        }
      }
    } catch (err) {
      console.error("Cron job error:", err);
    }
  };

  // 8.5 Temp folder cleanup
  const clearTempFolder = async () => {
    try {
      const { app } = require("electron");
      const fs = require("fs");
      const path = require("path");
      const tempDir = path.join(app.getPath("temp"), "rd_temp_downloads");
      try {
        await fs.promises.access(tempDir, fs.constants.F_OK);
      } catch {
        return;
      }
      const files = await fs.promises.readdir(tempDir);
      const now = Date.now();
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stat = await fs.promises.stat(filePath);
        if (now - stat.mtimeMs > 3600000) {
          await fs.promises.unlink(filePath).catch(() => {});
        }
      }
    } catch (e) {}
  };

  cleanupOldFiles();
  clearTempFolder();
  cleanupInterval = setInterval(cleanupOldFiles, 60 * 60 * 1000);
  tempCleanupInterval = setInterval(clearTempFolder, 60 * 60 * 1000);

  // 10. Background Reminder Checker
  reminderInterval = setInterval(async () => {
    try {
      const pool = getPool();
      if (!pool) return;

      const result = await pool.request().query(`
                SELECT Id, Content, CreatedBy_UserId FROM Records 
                WHERE Content LIKE '%"reminder"%' AND Content NOT LIKE '%"reminded":true%'
            `);

      const now = new Date();
      for (let row of result.recordset) {
        try {
          const data = JSON.parse(row.Content);
          if (data.datetime && data.reminder && !data.reminded) {
            const apptTime = new Date(data.datetime);
            const diffMins = (apptTime - now) / 60000;
            const reminderTarget =
              data.reminder === "custom"
                ? parseInt(data.customReminder || 0) * 24 * 60
                : parseInt(data.reminder);

            if (diffMins > 0 && diffMins <= reminderTarget) {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("reminder_notification", {
                  recordId: row.Id,
                  userId: row.CreatedBy_UserId,
                  name: data.name || data.customerName || data.title || data.city || "سجل بدون اسم",
                  datetime: data.datetime,
                  diffMins: Math.round(diffMins),
                });
              }
              // Mark as reminded in DB
              data.reminded = true;
              const updateReq = pool.request();
              updateReq.input("content", JSON.stringify(data));
              updateReq.input("rowId", row.Id);
              await updateReq.query(
                `UPDATE Records SET Content = @content WHERE Id = @rowId`,
              );
            }
          }
        } catch (e) {
          console.error("Reminder parse error:", e);
        }
      }
    } catch (err) {
      console.error("Reminder cron error:", err);
    }
  }, 60 * 1000);

  // 11. Empty Trash Manually
  ipcMain.handle("empty-trash", async (event, { userId }) => {
    try {
      const authService = require("../services/AuthorizationService.cjs");
      const pool = getPool();
      if (!pool) return { success: false, error: "Database not connected" };

      const currentUser = await fetchCurrentUser(pool, userId);
      if (!currentUser || (!authService.hasRole(currentUser, authService.ROLES.ADMIN) && !authService.hasRole(currentUser, authService.ROLES.ASSISTANT))) {
        return { success: false, error: "Unauthorized" };
      }

      // Fetch ALL deleted files to physically remove them from disk
      const result = await pool.request().query(`
          SELECT Id, FilePath FROM Files 
          WHERE IsDeleted = 1
      `);

      const fs = require("fs");
      let deletedCount = 0;
      for (let row of result.recordset) {
        try {
          await fs.promises.access(row.FilePath, fs.constants.F_OK);
          await fs.promises.unlink(row.FilePath);
        } catch (e) {}

        try {
          const delReq = pool.request();
          delReq.input("fileId", row.Id);
          await delReq.query(`DELETE FROM Files WHERE Id = @fileId`);
          deletedCount++;
        } catch (e) {
          console.error("Failed to hard delete file:", e);
        }
      }

      await logActivity(
        pool.request(),
        userId,
        "إفراغ سلة المهملات",
        "Files",
        null,
        { count: deletedCount }
      );

      return { success: true, count: deletedCount };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
};

