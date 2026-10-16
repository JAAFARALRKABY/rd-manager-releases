const departmentManagerRepository = require("../repositories/DepartmentManagerRepository.cjs");
const callManagerRepository = require("../repositories/CallManagerRepository.cjs");

const ROLES = {
  ADMIN: "admin",
  DEPARTMENT_MANAGER: "department_manager",
  SUPERVISOR: "supervisor",
  EMPLOYEE: "employee",
  ASSISTANT: "assistant",
};

const ERRORS = {
  ERR_PERMISSION_DENIED: "ERR_PERMISSION_DENIED",
  ERR_DEPARTMENT_ACCESS_DENIED: "ERR_DEPARTMENT_ACCESS_DENIED",
  ERR_ROLE_NOT_ALLOWED: "ERR_ROLE_NOT_ALLOWED",
  ERR_PRIVILEGE_ESCALATION: "ERR_PRIVILEGE_ESCALATION",
  ERR_INVALID_PERMISSION: "ERR_INVALID_PERMISSION",
};

/**
 * In-memory cache for fast authorization lookups
 * Structure: { [userId]: { subDepartments: number[], timestamp: number } }
 */
const authCache = {};
const CACHE_TTL_MS = 60000; // 60 seconds

class AuthorizationService {
  get ROLES() {
    return ROLES;
  }

  get ERRORS() {
    return ERRORS;
  }

  /**
   * Invalidate cache for a specific user, forcing a DB read on next check
   */
  invalidateCache(userId) {
    if (userId) {
      delete authCache[userId];
      delete authCache[`call_mgr_${userId}`];
    } else {
      // Clear all if no userId passed
      for (const key in authCache) {
        delete authCache[key];
      }
    }
  }

  /**
   * Basic role check
   */
  hasRole(user, role) {
    if (!user || !user.Role) return false;
    return user.Role === role;
  }

  /**
   * Universal access to sub-departments via Cache + Repository
   * Returns true if user has access to this SubDepartmentId
   */
  async hasDepartmentAccess(user, subDepartmentId) {
    if (!user || !subDepartmentId) return false;

    // Admins and Assistants have access to everything
    if (this.hasRole(user, ROLES.ADMIN) || this.hasRole(user, ROLES.ASSISTANT)) return true;

    // For Department Managers: check Junction Table (with caching)
    if (this.hasRole(user, ROLES.DEPARTMENT_MANAGER)) {
      let managed = await this._getCachedManagedSubDepartments(user.Id);
      if (managed.includes(Number(subDepartmentId))) return true;
    }

    // For Supervisors, Employees, etc.: check AllowedSubDepartments JSON field
    if (user.AllowedSubDepartments) {
      try {
        const allowed = JSON.parse(user.AllowedSubDepartments || "[]");
        if (allowed.includes("all")) return true;
        return allowed.includes(String(subDepartmentId));
      } catch (e) {
        return false;
      }
    }

    return false; // Default Deny
  }

  /**
   * Returns an array of SubDepartment IDs the user has access to.
   * Returns 'all' if the user is Admin or has 'all' access.
   * Useful for avoiding N+1 queries in SQL.
   */
  async getAllowedSubDepartmentIds(user) {
    if (!user) return [];
    if (this.hasRole(user, ROLES.ADMIN) || this.hasRole(user, ROLES.ASSISTANT)) return 'all';

    if (this.hasRole(user, ROLES.DEPARTMENT_MANAGER)) {
      const managed = await this._getCachedManagedSubDepartments(user.Id);
      if (managed.length > 0) return managed;
    }

    if (user.AllowedSubDepartments) {
      try {
        const allowed = JSON.parse(user.AllowedSubDepartments || "[]");
        if (allowed.includes("all")) return 'all';
        return allowed.map(Number).filter(n => !isNaN(n));
      } catch (e) {
        return [];
      }
    }

    return [];
  }

  /**
   * Internal caching logic for Department Managers
   */
  async _getCachedManagedSubDepartments(userId) {
    const now = Date.now();
    const cached = authCache[userId];
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.subDepartments;
    }
    const freshData = await departmentManagerRepository.getManagedSubDepartments(userId);
    authCache[userId] = {
      subDepartments: freshData,
      timestamp: now,
    };
    return freshData;
  }

  // ==========================================
  // CALL MANAGER PERMISSIONS
  // ==========================================

  /**
   * Internal caching logic for Call Managers
   */
  async _getCachedCallManagerSubDepartments(userId) {
    const cacheKey = `call_mgr_${userId}`;
    const now = Date.now();
    const cached = authCache[cacheKey];
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.subDepartments;
    }
    const freshData = await callManagerRepository.getManagedSubDepartments(userId);
    authCache[cacheKey] = {
      subDepartments: freshData,
      timestamp: now,
    };
    return freshData;
  }

  /**
   * Check if user is a Call Manager for a specific SubDepartment
   */
  async isCallManagerFor(user, subDepartmentId) {
    if (!user || !subDepartmentId) return false;
    const callManagerSubs = await this._getCachedCallManagerSubDepartments(user.Id);
    return callManagerSubs.includes(Number(subDepartmentId));
  }

  /**
   * Get all SubDepartments where user is a Call Manager
   */
  async getCallManagerSubDepartments(user) {
    if (!user) return [];
    return await this._getCachedCallManagerSubDepartments(user.Id);
  }

  // ==========================================
  // USER MANAGEMENT PERMISSIONS
  // ==========================================

  /**
   * Checks if an actor can manage a target user
   */
  async canManageUser(actor, targetUser) {
    if (!actor) return false;
    if (this.hasRole(actor, ROLES.ADMIN)) return true;

    if (this.hasRole(actor, ROLES.DEPARTMENT_MANAGER)) {
      // Target must exist
      if (!targetUser) return false;
      
      // Privilege Escalation Prevention
      if (
        this.hasRole(targetUser, ROLES.ADMIN) || 
        this.hasRole(targetUser, ROLES.DEPARTMENT_MANAGER)
      ) {
        return false;
      }

      // Must share at least one sub-department that the actor manages
      const actorManaged = await this._getCachedManagedSubDepartments(actor.Id);
      let targetAllowed = [];
      try {
        targetAllowed = JSON.parse(targetUser.AllowedSubDepartments || "[]");
      } catch(e) {}
      
      if (targetAllowed.includes("all")) return false; // Dept Manager cannot manage someone with "all" access

      const overlaps = targetAllowed.some(subId => actorManaged.includes(Number(subId)));
      return overlaps;
    }

    return false; // Default Deny
  }

  /**
   * Checks if actor can CREATE a user with specified role and sub-departments
   */
  async canCreateUser(actor, newRole, targetSubDepartments = []) {
    if (!actor) return false;
    if (this.hasRole(actor, ROLES.ADMIN)) return true;

    if (this.hasRole(actor, ROLES.DEPARTMENT_MANAGER)) {
      // Prevent Privilege Escalation
      if (newRole === ROLES.ADMIN || newRole === ROLES.DEPARTMENT_MANAGER) {
        throw new Error(ERRORS.ERR_PRIVILEGE_ESCALATION);
      }
      
      // Prevent assigning to sub-departments they don't own
      const actorManaged = await this._getCachedManagedSubDepartments(actor.Id);
      const invalidAssign = targetSubDepartments.some(subId => !actorManaged.includes(Number(subId)));
      if (invalidAssign) {
        throw new Error(ERRORS.ERR_DEPARTMENT_ACCESS_DENIED);
      }
      return true;
    }

    return false; // Default Deny
  }

  async canEditUser(actor, targetUser) {
    return await this.canManageUser(actor, targetUser);
  }

  async canDeleteUser(actor, targetUser) {
    return await this.canManageUser(actor, targetUser);
  }


  // ==========================================
  // RECORDS, REQUESTS & FILES (Placeholders for Universal Filtering)
  // ==========================================

  async canViewRecord(actor, record) {
    if (!actor || !record) return false;
    return await this.hasDepartmentAccess(actor, record.SubDepartmentId);
  }

  async canEditRecord(actor, record) {
    if (!actor || !record) return false;
    return await this.hasDepartmentAccess(actor, record.SubDepartmentId);
  }

  async canDeleteRecord(actor, record) {
    if (!actor || !record) return false;
    return await this.hasDepartmentAccess(actor, record.SubDepartmentId);
  }

  // Basic permission check placeholder for future granular permissions
  hasPermission(actor, permissionName) {
    // e.g. mapping ROLES to specific permission strings in the future
    if (this.hasRole(actor, ROLES.ADMIN)) return true;
    return false; // Default Deny
  }
}

module.exports = new AuthorizationService();
