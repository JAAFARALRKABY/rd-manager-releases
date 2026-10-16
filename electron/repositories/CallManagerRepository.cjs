const { getPool } = require("../db.cjs");

/**
 * DepartmentManagerRepository
 * 
 * Responsible strictly for data access related to Department Managers.
 * Contains NO business logic, NO permission checks, and NO role verification.
 * All queries are fully parameterized and strictly avoid SELECT *.
 */

class DepartmentManagerRepository {
  /**
   * Retrieves all SubDepartment IDs managed by a specific user.
   * @param {number} userId 
   * @returns {Promise<number[]>} Array of SubDepartment IDs
   */
  async getManagedSubDepartments(userId) {
    const pool = getPool();
    if (!pool) throw new Error("Database connection not ready");
    
    const result = await pool.request().input("userId", userId).query(`
        SELECT SubDepartmentId 
        FROM CallManagers 
        WHERE UserId = @userId
    `);
    
    return result.recordset.map(row => row.SubDepartmentId);
  }

  /**
   * Checks if a user manages a specific SubDepartment.
   * @param {number} userId 
   * @param {number} subDepartmentId 
   * @returns {Promise<boolean>}
   */
  async hasAccess(userId, subDepartmentId) {
    const pool = getPool();
    if (!pool) throw new Error("Database connection not ready");
    
    const request = pool.request();
    request.input("userId", userId);
    request.input("subDepartmentId", subDepartmentId);
    
    const result = await request.query(`
      SELECT TOP 1 1 AS HasAccess
      FROM CallManagers 
      WHERE UserId = @userId AND SubDepartmentId = @subDepartmentId
    `);
    
    return result.recordset.length > 0;
  }

  /**
   * Assigns a user to manage a specific SubDepartment.
   * Ignores if already assigned (due to UNIQUE constraint logic, or we can use IF NOT EXISTS).
   * @param {number} userId 
   * @param {number} subDepartmentId 
   * @returns {Promise<boolean>} True if assigned, False if it already existed
   */
  async assignManager(userId, subDepartmentId) {
    const pool = getPool();
    if (!pool) throw new Error("Database connection not ready");
    
    const request = pool.request();
    request.input("userId", userId);
    request.input("subDepartmentId", subDepartmentId);
    
    const result = await request.query(`
      IF NOT EXISTS (
          SELECT 1 FROM CallManagers 
          WHERE UserId = @userId AND SubDepartmentId = @subDepartmentId
      )
      BEGIN
          INSERT INTO CallManagers (UserId, SubDepartmentId)
          VALUES (@userId, @subDepartmentId);
          SELECT 1 AS Inserted;
      END
      ELSE
      BEGIN
          SELECT 0 AS Inserted;
      END
    `);
    
    return result.recordset[0].Inserted === 1;
  }

  /**
   * Removes a user from managing a specific SubDepartment.
   * @param {number} userId 
   * @param {number} subDepartmentId 
   * @returns {Promise<void>}
   */
  async removeManager(userId, subDepartmentId) {
    const pool = getPool();
    if (!pool) throw new Error("Database connection not ready");
    
    const request = pool.request();
    request.input("userId", userId);
    request.input("subDepartmentId", subDepartmentId);
    
    await request.query(`
      DELETE FROM CallManagers 
      WHERE UserId = @userId AND SubDepartmentId = @subDepartmentId
    `);
  }

  /**
   * Retrieves all User IDs that are managing a specific SubDepartment.
   * @param {number} subDepartmentId 
   * @returns {Promise<number[]>} Array of User IDs
   */
  async getManagers(subDepartmentId) {
    const pool = getPool();
    if (!pool) throw new Error("Database connection not ready");
    
    const request = pool.request();
    request.input("subDepartmentId", subDepartmentId);
    
    const result = await request.query(`
      SELECT UserId 
      FROM CallManagers 
      WHERE SubDepartmentId = @subDepartmentId
    `);
    
    return result.recordset.map(row => row.UserId);
  }
}

module.exports = new DepartmentManagerRepository();
