const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { connectDB, getPool, sql } = require("./db");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Upload directory for mobile uploads
const UPLOAD_DIR = path.join(__dirname, "uploads");
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
  Users: ["Username", "FullName", "PasswordHash", "Role", "AllowedSubDepartments", "CallManagerSubs", "IsActive"],
  Departments: ["Name", "SortOrder"],
  CustomCategories: ["Name", "SubDepartmentId"],
  SubDepartments: ["DepartmentId", "Name"],
  Records: ["SubDepartmentId", "CreatedBy_UserId", "SearchIndex", "Content"],
  Files: ["RecordId", "FilePath", "FileType", "FileSize", "IsDeleted", "DeletedAt", "FileData"],
  ActivityLogs: ["UserId", "Action", "TargetTable", "TargetId", "Details", "IPAddress"],
  Requests: ["CreatedBy_UserId", "SubDepartmentId", "DepartmentId", "Title", "Content", "Status"],
};

async function logActivity(request, userId, action, targetTable, targetId, details = null) {
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

// Health check endpoint
app.get("/api/health", (req, res) => {
  const pool = getPool();
  res.json({
    status: "online",
    dbConnected: !!pool,
    timestamp: new Date().toISOString(),
    version: "1.0.20",
  });
});

// Unified Invoke Gateway (Mirrors Electron ipcRenderer.invoke)
app.post("/api/invoke", async (req, res) => {
  const { channel, payload } = req.body;
  const pool = getPool();

  if (!pool && channel !== "check-db-connection") {
    return res.status(503).json({ success: false, error: "Database not connected" });
  }

  try {
    switch (channel) {
      case "check-db-connection": {
        return res.json({ connected: !!pool });
      }

      case "login": {
        const { username, password } = payload || {};
        if (!username || !password) {
          return res.json({ success: false, error: "يرجى إدخال اسم المستخدم وكلمة المرور" });
        }
        const request = pool.request();
        request.input("username", username);
        const result = await request.query(
          "SELECT * FROM Users WHERE Username = @username AND (IsActive = 1 OR IsActive IS NULL)"
        );
        if (result.recordset.length > 0) {
          const user = result.recordset[0];
          const isValid = await bcrypt.compare(password, user.PasswordHash);
          if (isValid) {
            const { PasswordHash, ...safeUser } = user;

            // Fetch call manager subs if any
            const cmRes = await pool.request().input("uid", user.Id).query(
              "SELECT SubDepartmentId FROM CallManagers WHERE UserId = @uid"
            );
            safeUser.CallManagerSubs = cmRes.recordset.map(r => r.SubDepartmentId.toString());

            // Log activity
            const logReq = pool.request();
            logReq.input("userId", user.Id);
            logReq.input("action", "login_mobile");
            logReq.input("details", JSON.stringify({ platform: "mobile_api" }));
            logReq.input("sysCreatedAt", new Date());
            await logReq.query(`
              INSERT INTO ActivityLogs (UserId, Action, Details, CreatedAt)
              VALUES (@userId, @action, @details, @sysCreatedAt)
            `);

            return res.json({ success: true, user: safeUser });
          }
        }
        return res.json({ success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      case "verify-session": {
        const { userId } = payload || {};
        if (!userId) return res.json({ success: false, error: "Missing userId" });
        const request = pool.request();
        request.input("userId", userId);
        const result = await request.query(
          "SELECT Id, Username, Role, FullName, AllowedSubDepartments, IsActive FROM Users WHERE Id = @userId AND (IsActive = 1 OR IsActive IS NULL)"
        );
        if (result.recordset.length > 0) {
          const user = result.recordset[0];
          const cmRes = await pool.request().input("uid", user.Id).query(
            "SELECT SubDepartmentId FROM CallManagers WHERE UserId = @uid"
          );
          user.CallManagerSubs = cmRes.recordset.map(r => r.SubDepartmentId.toString());
          return res.json({ success: true, user });
        }
        return res.json({ success: false, error: "المستخدم غير موجود أو غير نشط" });
      }

      case "logout": {
        return res.json({ success: true });
      }

      case "get-table-data": {
        const { table, currentUser } = payload || {};
        const safeTable = TABLES[(table || "").toLowerCase()];
        if (!safeTable) return res.json({ success: false, error: "Invalid table" });

        let query = `SELECT * FROM ${safeTable}`;
        if (safeTable === "Files") {
          query = "SELECT Id, RecordId, FilePath, FileType, FileSize, CreatedAt, IsDeleted FROM Files";
        }

        const request = pool.request();
        const conditions = [];

        if (safeTable === "Users") {
          conditions.push("(IsActive = 1 OR IsActive IS NULL)");
        }

        // Role-based visibility
        if ((safeTable === "Records" || safeTable === "Requests") && currentUser) {
          if (currentUser.Role === "employee") {
            request.input("currUserId", currentUser.Id);
            if (safeTable === "Records") {
              conditions.push("(CreatedBy_UserId = @currUserId OR SubDepartmentId IN (SELECT Id FROM SubDepartments WHERE Name LIKE N'%مطلوب%' AND Name LIKE N'%اتصال%'))");
            } else {
              conditions.push("CreatedBy_UserId = @currUserId");
            }
          } else if (currentUser.Role !== "admin" && currentUser.Role !== "assistant") {
            try {
              const allowed = JSON.parse(currentUser.AllowedSubDepartments || "[]");
              if (!allowed.includes("all")) {
                if (allowed.length > 0) {
                  const paramNames = allowed.map((_, i) => `@allowedSub${i}`);
                  allowed.forEach((sub, i) => request.input(`allowedSub${i}`, sub));
                  conditions.push(`SubDepartmentId IN (${paramNames.join(", ")})`);
                } else {
                  conditions.push("1 = 0");
                }
              }
            } catch (e) {}
          }
        }

        if (conditions.length > 0) {
          query += " WHERE " + conditions.join(" AND ");
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

        return res.json({ success: true, data });
      }

      case "add-record": {
        const { table, data, userId } = payload || {};
        const safeTable = TABLES[(table || "").toLowerCase()];
        if (!safeTable) return res.json({ success: false, error: "Invalid table" });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
          const request = transaction.request();
          const validColumns = ALLOWED_COLUMNS[safeTable] || [];
          const keysArr = Object.keys(data).filter(k => validColumns.includes(k));
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
          await logActivity(request, userId, "add", safeTable, newId);
          await transaction.commit();
          return res.json({ success: true, id: newId });
        } catch (txErr) {
          await transaction.rollback();
          return res.json({ success: false, error: txErr.message });
        }
      }

      case "update-record": {
        const { table, id, data, userId } = payload || {};
        const safeTable = TABLES[(table || "").toLowerCase()];
        if (!safeTable) return res.json({ success: false, error: "Invalid table" });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
          const request = transaction.request();
          const validColumns = ALLOWED_COLUMNS[safeTable] || [];
          const updatesArr = Object.keys(data)
            .filter(k => validColumns.includes(k))
            .map((k, i) => {
              request.input(`p${i}`, data[k] === null ? null : data[k]);
              return `${k} = @p${i}`;
            });

          if (updatesArr.length === 0) throw new Error("No valid columns to update");

          const updates = updatesArr.join(", ");
          request.input("id", id);
          await request.query(`UPDATE ${safeTable} SET ${updates} WHERE Id = @id`);

          await logActivity(request, userId, "edit", safeTable, id);
          await transaction.commit();
          return res.json({ success: true });
        } catch (txErr) {
          await transaction.rollback();
          return res.json({ success: false, error: txErr.message });
        }
      }

      case "delete-record": {
        const { table, id, userId } = payload || {};
        const safeTable = TABLES[(table || "").toLowerCase()];
        if (!safeTable) return res.json({ success: false, error: "Invalid table" });

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
          const request = transaction.request();
          request.input("id", id);
          if (safeTable === "Users") {
            await request.query("DELETE FROM ActivityLogs WHERE UserId = @id");
          }
          await request.query(`DELETE FROM ${safeTable} WHERE Id = @id`);
          await logActivity(request, userId, "delete", safeTable, id);
          await transaction.commit();
          return res.json({ success: true });
        } catch (txErr) {
          await transaction.rollback();
          return res.json({ success: false, error: txErr.message });
        }
      }

      case "upload-file": {
        const { fileData, fileName, fileType, recordId, userId } = payload || {};
        const base64Content = (fileData || "").split(",")[1] || fileData;
        const buffer = Buffer.from(base64Content, "base64");
        const fileSize = buffer.length;

        if (fileSize > 50 * 1024 * 1024) {
          return res.json({ success: false, error: "الملف كبير جداً (أقصى حد 50MB)" });
        }

        const sanitizedFileName = path.basename(fileName || "upload.bin");
        const uniqueName = Date.now() + "_" + sanitizedFileName;
        const fullPath = path.join(UPLOAD_DIR, uniqueName);
        await fs.promises.writeFile(fullPath, buffer);

        const request = pool.request();
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

        return res.json({ success: true, id: result.recordset[0].Id, path: fullPath });
      }

      case "get-users": {
        const result = await pool.request().query(
          "SELECT Id, Username, Role, AllowedSubDepartments, CreatedAt, IsActive FROM Users WHERE IsActive = 1 OR IsActive IS NULL"
        );
        return res.json({ success: true, data: result.recordset });
      }

      case "check-for-updates": {
        return res.json({ success: true, hasUpdate: false });
      }

      default: {
        return res.json({ success: true, message: `Channel ${channel} handled` });
      }
    }
  } catch (err) {
    console.error(`Error in /api/invoke [${channel}]:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Start listening
connectDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 [RD Manager API Server] Running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start API Server due to DB connection:", err);
  });
