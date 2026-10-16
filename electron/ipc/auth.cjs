const { ipcMain } = require("electron");
const { getPool } = require("../db.cjs");
const { hashPassword, comparePassword } = require("../crypto.cjs");

module.exports = function setupAuthHandlers() {
  ipcMain.handle("login", async (event, { username, password }) => {
    try {
      const pool = getPool();
      if (!pool) return { success: false, error: "Database not connected" };

      const request = pool.request();
      request.input("username", username);
      const result = await request.query(
        `SELECT * FROM Users WHERE Username = @username AND (IsActive = 1 OR IsActive IS NULL)`,
      );

      if (result.recordset.length > 0) {
        const user = result.recordset[0];
        const isValid = await comparePassword(password, user.PasswordHash);
        if (isValid) {
          const { PasswordHash, ...safeUser } = user;

          // Log the activity
          const logReq = pool.request();
          logReq.input("userId", user.Id);
          logReq.input("action", "login");
          logReq.input(
            "details",
            JSON.stringify({ message: "User logged in" }),
          );
          logReq.input("sysCreatedAt", new Date());
          await logReq.query(`
                        INSERT INTO ActivityLogs (UserId, Action, Details, CreatedAt)
                        VALUES (@userId, @action, @details, @sysCreatedAt)
                    `);

          const authService = require("../services/AuthorizationService.cjs");
          safeUser.CallManagerSubs = await authService.getCallManagerSubDepartments(safeUser);
          
          return { success: true, user: safeUser };
        }
      }
      return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("verify-session", async (event, { userId }) => {
    try {
      const pool = getPool();
      if (!pool) return { success: false, error: "Database not connected" };

      const request = pool.request();
      request.input("userId", userId);
      const result = await request.query(
        `SELECT Id, Username, Role, FullName, AllowedSubDepartments, IsActive FROM Users WHERE Id = @userId AND (IsActive = 1 OR IsActive IS NULL)`,
      );

      if (result.recordset.length > 0) {
        const user = result.recordset[0];
        const authService = require("../services/AuthorizationService.cjs");
        user.CallManagerSubs = await authService.getCallManagerSubDepartments(user);
        return { success: true, user };
      }
      return { success: false, error: "المستخدم غير موجود أو غير نشط" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("logout", async (event, { userId }) => {
    try {
      const pool = getPool();
      if (pool && userId) {
        const request = pool.request();
        request.input("userId", userId);
        request.input("action", "logout");
        request.input(
          "details",
          JSON.stringify({ message: "User logged out" }),
        );
        request.input("sysCreatedAt", new Date());
        await request.query(`
                    INSERT INTO ActivityLogs (UserId, Action, Details, CreatedAt)
                    VALUES (@userId, @action, @details, @sysCreatedAt)
                `);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("get-users", async () => {
    try {
      const pool = getPool();
      if (!pool) return { success: false, error: "Database not connected" };
      const result = await pool
        .request()
        .query(
          "SELECT Id, Username, Role, AllowedSubDepartments, CreatedAt, IsActive FROM Users WHERE IsActive = 1 OR IsActive IS NULL",
        );
      return { success: true, data: result.recordset };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("add-user", async (event, { adminId, user }) => {
    try {
      const authService = require("../services/AuthorizationService.cjs");
      const pool = getPool();
      if (!pool) return { success: false, error: "Database not connected" };

      // Fetch actor
      const actorRes = await pool.request().input("uid", adminId).query("SELECT * FROM Users WHERE Id = @uid");
      const actor = actorRes.recordset[0];
      if (!actor) return { success: false, error: "Actor not found" };

      const targetSubs = user.allowedSubDepartments || [];
      const canCreate = await authService.canCreateUser(actor, user.role, targetSubs);
      if (!canCreate) return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };
      const hashedPw = await hashPassword(user.password);

      // If the actor is a department_manager and no subs specified, auto-assign their managed subs
      let finalAllowedSubs = user.allowedSubDepartments || [];
      if (authService.hasRole(actor, authService.ROLES.DEPARTMENT_MANAGER) && finalAllowedSubs.length === 0) {
        const managedSubs = await authService.getAllowedSubDepartmentIds(actor);
        if (managedSubs !== 'all') {
          finalAllowedSubs = managedSubs.map(String);
        }
      }

      // Expected user object: { username, password, role, allowedSubDepartments: [] }
      const allowed = JSON.stringify(finalAllowedSubs);

      const request = pool.request();
      request.input("username", user.username);
      request.input("fullName", user.fullName || "");
      request.input("hashedPw", hashedPw);
      request.input("role", user.role);
      request.input("allowed", allowed);
      request.input("sysCreatedAt", new Date());

      await request.query(`
                INSERT INTO Users (Username, FullName, PasswordHash, Role, AllowedSubDepartments, CreatedAt)
                VALUES (@username, @fullName, @hashedPw, @role, @allowed, @sysCreatedAt)
            `);

      // Log it
      if (adminId) {
        const logReq = pool.request();
        logReq.input("adminId", adminId);
        logReq.input("action", "add");
        logReq.input(
          "details",
          JSON.stringify({ username: user.username, role: user.role }),
        );
        logReq.input("sysCreatedAt", new Date());
        await logReq.query(`
                    INSERT INTO ActivityLogs (UserId, Action, TargetTable, Details, CreatedAt)
                    VALUES (@adminId, @action, 'Users', @details, @sysCreatedAt)
                `);
      }

      return { success: true };
    } catch (err) {
      if (
        err.message.includes("UNIQUE KEY constraint") ||
        err.message.includes("Cannot insert duplicate key")
      ) {
        return {
          success: false,
          error: "اسم المستخدم هذا موجود مسبقاً، الرجاء اختيار اسم آخر",
        };
      }
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("get-inactive-users", async (event, { userId } = {}) => {
    try {
      const authService = require("../services/AuthorizationService.cjs");
      const pool = getPool();
      if (!pool) return { success: false, error: "Database not connected" };
      if (!userId) return { success: false, error: "Unauthorized" };

      const currentUser = await pool.request().input("uid", userId).query("SELECT * FROM Users WHERE Id = @uid").then(r => r.recordset[0]);
      if (!currentUser || !authService.hasRole(currentUser, authService.ROLES.ADMIN)) {
        return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };
      }

      const result = await pool
        .request()
        .query(
          "SELECT Id, Username, Role, AllowedSubDepartments, CreatedAt, IsActive FROM Users WHERE IsActive = 0",
        );
      return { success: true, data: result.recordset };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    "delete-user-advanced",
    async (event, { targetUserId, deleteRecords, adminId }) => {
      try {
        const authService = require("../services/AuthorizationService.cjs");
        const pool = getPool();
        if (!pool) return { success: false, error: "Database not connected" };

        const actorRes = await pool.request().input("uid", adminId).query("SELECT * FROM Users WHERE Id = @uid");
        const actor = actorRes.recordset[0];
        if (!actor) return { success: false, error: "Actor not found" };

        const targetRes = await pool.request().input("tid", targetUserId).query("SELECT * FROM Users WHERE Id = @tid");
        const targetUser = targetRes.recordset[0];
        if (!targetUser) return { success: false, error: "Target user not found" };

        const canDelete = await authService.canDeleteUser(actor, targetUser);
        if (!canDelete) return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };

        const request = pool.request();
        request.input("targetUserId", targetUserId);

        if (deleteRecords) {
          // Delete everything
          await request.query(
            `DELETE FROM Records WHERE CreatedBy_UserId = @targetUserId`,
          );
          await request.query(
            `DELETE FROM Requests WHERE CreatedBy_UserId = @targetUserId`,
          );
          await request.query(
            `DELETE FROM ActivityLogs WHERE UserId = @targetUserId`,
          );
          await request.query(`DELETE FROM Users WHERE Id = @targetUserId`);
        } else {
          // Soft delete
          await request.query(
            `UPDATE Users SET IsActive = 0, PasswordHash = 'DISABLED_ACCOUNT' WHERE Id = @targetUserId`,
          );
          // Also kill any active sessions from logs
          await request.query(
            `DELETE FROM ActivityLogs WHERE UserId = @targetUserId`,
          );
        }

        // Log it
        if (adminId) {
          const logReq = pool.request();
          logReq.input("adminId", adminId);
          logReq.input("action", "delete");
          logReq.input(
            "details",
            JSON.stringify({
              deletedUserId: targetUserId,
              recordsDeleted: deleteRecords,
            }),
          );
          await logReq.query(`
                    INSERT INTO ActivityLogs (UserId, Action, TargetTable, Details)
                    VALUES (@adminId, @action, 'Users', @details)
                `);
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle(
    "edit-user-details",
    async (
      event,
      { targetUserId, newFullName, newUsername, newPassword, adminId },
    ) => {
      try {
        const authService = require("../services/AuthorizationService.cjs");
        const pool = getPool();
        if (!pool) return { success: false, error: "Database not connected" };

        const actorRes = await pool.request().input("uid", adminId).query("SELECT * FROM Users WHERE Id = @uid");
        const actor = actorRes.recordset[0];
        if (!actor) return { success: false, error: "Actor not found" };

        const targetRes = await pool.request().input("tid", targetUserId).query("SELECT * FROM Users WHERE Id = @tid");
        const targetUser = targetRes.recordset[0];
        if (!targetUser) return { success: false, error: "Target user not found" };

        const canEdit = await authService.canEditUser(actor, targetUser);
        if (!canEdit) return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };

        const request = pool.request();
        request.input("fullName", newFullName);
        request.input("username", newUsername);
        request.input("userId", targetUserId);

        let query = `UPDATE Users SET FullName = @fullName, Username = @username`;
        if (newPassword && newPassword.trim() !== "") {
          const hashedPw = await hashPassword(newPassword);
          request.input("hashedPw", hashedPw);
          query += `, PasswordHash = @hashedPw`;
        }
        query += ` WHERE Id = @userId`;

        await request.query(query);

        if (adminId) {
          const logReq = pool.request();
          logReq.input("adminId", adminId);
          logReq.input("action", "edit");
          logReq.input(
            "details",
            JSON.stringify({ action: "edited_user_details", targetUserId }),
          );
          await logReq.query(`
                    INSERT INTO ActivityLogs (UserId, Action, TargetTable, Details)
                    VALUES (@adminId, @action, 'Users', @details)
                `);
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );

  ipcMain.handle(
    "restore-user",
    async (event, { targetUserId, newPassword, adminId }) => {
      try {
        const authService = require("../services/AuthorizationService.cjs");
        const pool = getPool();
        if (!pool) return { success: false, error: "Database not connected" };

        const actorRes = await pool.request().input("uid", adminId).query("SELECT * FROM Users WHERE Id = @uid");
        const actor = actorRes.recordset[0];
        if (!actor) return { success: false, error: "Actor not found" };

        const targetRes = await pool.request().input("tid", targetUserId).query("SELECT * FROM Users WHERE Id = @tid");
        const targetUser = targetRes.recordset[0];
        if (!targetUser) return { success: false, error: "Target user not found" };

        const canEdit = await authService.canEditUser(actor, targetUser);
        if (!canEdit) return { success: false, error: authService.ERRORS.ERR_PERMISSION_DENIED };

        const hashedPw = await hashPassword(newPassword);
        const request = pool.request();
        request.input("hashedPw", hashedPw);
        request.input("userId", targetUserId);
        await request.query(
          `UPDATE Users SET IsActive = 1, PasswordHash = @hashedPw WHERE Id = @userId`,
        );

        if (adminId) {
          const logReq = pool.request();
          logReq.input("adminId", adminId);
          logReq.input("action", "edit");
          logReq.input(
            "details",
            JSON.stringify({ action: "restored_user", targetUserId }),
          );
          await logReq.query(`
                    INSERT INTO ActivityLogs (UserId, Action, TargetTable, Details)
                    VALUES (@adminId, @action, 'Users', @details)
                `);
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  );
};
