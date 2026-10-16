const sql = require("mssql");
const { hashPassword } = require("./crypto.cjs");

let pool = null;
let lastDbError = null;
let isDbReady = false;

const connectDB = async (config) => {
  try {
    lastDbError = null;
    const finalConfig = {
      user: config.dbUser,
      password: config.dbPassword,
      server: config.serverIp,
      database: config.dbName,
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      options: { encrypt: false, trustServerCertificate: true, useUTC: false },
    };

    pool = await sql.connect(finalConfig);
    console.log("Connected to MSSQL Database");
    isDbReady = true;
    return true;
  } catch (err) {
    lastDbError = err.message;
    console.error("Database connection failed: ", err);
    throw err;
  }
};

const getPool = () => pool;
const getLastDbError = () => lastDbError;
const getIsDbReady = () => isDbReady;

const initializeTables = async () => {
  if (!pool) throw new Error("Database not connected");

  try {
    const request = pool.request();

    // 1. Drop old tables if requested (to keep the DB clean)
    const oldTables = [
      "ClientFollowUps",
      "Appointments",
      "Brokers",
      "Complexes",
      "Investments",
      "RealEstate",
    ];
    for (const table of oldTables) {
      try {
        await request.query(
          `IF EXISTS (SELECT * FROM sysobjects WHERE name='${table}' AND xtype='U') DROP TABLE ${table}`,
        );
      } catch (ignored) {}
    }

    // 2. Re-create or Update Users Table (Drop old one to refresh schema if needed, but we'll try to ALTER or recreate)
    // Since we are changing schema drastically, let's check if 'AllowedSubDepartments' exists.
    const checkUsers = await request.query(
      `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U') SELECT 0 AS exists_flag ELSE SELECT 1 AS exists_flag`,
    );
    if (checkUsers.recordset[0].exists_flag === 0) {
      await request.query(`
                CREATE TABLE Users (
                    Id INT PRIMARY KEY IDENTITY(1,1),
                    Username NVARCHAR(100) UNIQUE NOT NULL,
                    FullName NVARCHAR(255) NULL,
                    PasswordHash NVARCHAR(255) NOT NULL,
                    Role NVARCHAR(50) NOT NULL, -- 'admin', 'assistant', 'employee'
                    AllowedSubDepartments NVARCHAR(MAX) DEFAULT '[]', -- JSON array of allowed sub-department IDs
                    CreatedAt DATETIME DEFAULT GETDATE()
                )
            `);
    } else {
      // Alter to add AllowedSubDepartments if it doesn't exist (Migrating from v1 to v2)
      await request.query(`
                IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'AllowedSubDepartments' AND Object_ID = Object_ID(N'Users'))
                BEGIN
                    ALTER TABLE Users ADD AllowedSubDepartments NVARCHAR(MAX) DEFAULT '[]'
                END
                IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'IsActive' AND Object_ID = Object_ID(N'Users'))
                BEGIN
                    ALTER TABLE Users ADD IsActive BIT DEFAULT 1
                END
                IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'FullName' AND Object_ID = Object_ID(N'Users'))
                BEGIN
                    ALTER TABLE Users ADD FullName NVARCHAR(255) NULL
                END
            `);
    }

    // Create default admin
    const adminCheck = await request.query(
      `SELECT COUNT(*) as count FROM Users WHERE Role = 'admin'`,
    );
    if (adminCheck.recordset[0].count === 0) {
      const defaultPassword = await hashPassword("N$4zQ8!wLm2#Xa9");
      await request.query(`
                INSERT INTO Users (Username, FullName, PasswordHash, Role, AllowedSubDepartments)
                VALUES ('T8#vQ2!mL9@rPx7', N'مدير النظام', '${defaultPassword}', 'admin', '["all"]')
            `);
    }

    // 3. Departments
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Departments' AND xtype='U')
            CREATE TABLE Departments (
                Id INT PRIMARY KEY IDENTITY(1,1),
                Name NVARCHAR(100) NOT NULL UNIQUE,
                CreatedAt DATETIME DEFAULT GETDATE()
            )
        `);

    // 3.5 Custom Categories for Customers
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CustomCategories' AND xtype='U')
            CREATE TABLE CustomCategories (
                Id INT PRIMARY KEY IDENTITY(1,1),
                Name NVARCHAR(100) NOT NULL UNIQUE,
                CreatedAt DATETIME DEFAULT GETDATE()
            )
        `);

    // 4. SubDepartments
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SubDepartments' AND xtype='U')
            CREATE TABLE SubDepartments (
                Id INT PRIMARY KEY IDENTITY(1,1),
                DepartmentId INT NOT NULL,
                Name NVARCHAR(255) NOT NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (DepartmentId) REFERENCES Departments(Id) ON DELETE CASCADE
            )
        `);

    // 4.5 DepartmentManagers (Junction Table for Granular Authorization)
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DepartmentManagers' AND xtype='U')
            BEGIN
                CREATE TABLE DepartmentManagers (
                    Id INT PRIMARY KEY IDENTITY(1,1),
                    UserId INT NOT NULL,
                    SubDepartmentId INT NOT NULL,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
                    FOREIGN KEY (SubDepartmentId) REFERENCES SubDepartments(Id) ON DELETE CASCADE,
                    CONSTRAINT UQ_User_SubDep UNIQUE(UserId, SubDepartmentId)
                );
                
                -- Create Indexes for Performance
                CREATE INDEX IX_DepartmentManagers_UserId ON DepartmentManagers(UserId);
                CREATE INDEX IX_DepartmentManagers_SubDepId ON DepartmentManagers(SubDepartmentId);
            END
        `);

    // 4.6 CallManagers (Junction Table for Call Management Authorization)
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CallManagers' AND xtype='U')
            BEGIN
                CREATE TABLE CallManagers (
                    Id INT PRIMARY KEY IDENTITY(1,1),
                    UserId INT NOT NULL,
                    SubDepartmentId INT NOT NULL,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
                    FOREIGN KEY (SubDepartmentId) REFERENCES SubDepartments(Id) ON DELETE CASCADE,
                    CONSTRAINT UQ_CallManager_User_SubDep UNIQUE(UserId, SubDepartmentId)
                );
                
                CREATE INDEX IX_CallManagers_UserId ON CallManagers(UserId);
                CREATE INDEX IX_CallManagers_SubDepId ON CallManagers(SubDepartmentId);
            END
        `);

    // 5. Records (Dynamic JSON Data)
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Records' AND xtype='U')
            CREATE TABLE Records (
                Id INT PRIMARY KEY IDENTITY(1,1),
                SubDepartmentId INT NOT NULL,
                CreatedBy_UserId INT NOT NULL,
                SearchIndex NVARCHAR(MAX), -- Flattened string for ultra-fast text search
                Content NVARCHAR(MAX) NOT NULL, -- JSON object containing all the dynamic fields
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (SubDepartmentId) REFERENCES SubDepartments(Id) ON DELETE CASCADE,
                FOREIGN KEY (CreatedBy_UserId) REFERENCES Users(Id) ON DELETE CASCADE
            )
        `);

    // 6. Files Management
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Files' AND xtype='U')
            CREATE TABLE Files (
                Id INT PRIMARY KEY IDENTITY(1,1),
                RecordId INT NULL, -- Can be null if it's a general file or attached later
                FilePath NVARCHAR(MAX) NOT NULL,
                FileType NVARCHAR(50),
                FileSize INT,
                IsDeleted BIT DEFAULT 0,
                DeletedAt DATETIME NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (RecordId) REFERENCES Records(Id) ON DELETE CASCADE
            )
        `);

    // 7. Activity Logs
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ActivityLogs' AND xtype='U')
            CREATE TABLE ActivityLogs (
                Id INT PRIMARY KEY IDENTITY(1,1),
                UserId INT NOT NULL,
                Action NVARCHAR(100) NOT NULL, -- 'login', 'logout', 'add', 'edit', 'delete', 'export', 'upload', 'restore'
                TargetTable NVARCHAR(100) NULL,
                TargetId INT NULL,
                Details NVARCHAR(MAX) NULL, -- JSON for context
                IPAddress NVARCHAR(100) NULL,
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE NO ACTION
            )

            -- Extend ActivityLogs with new columns for Enterprise Audit Trail
            IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'Category' AND Object_ID = Object_ID(N'ActivityLogs'))
            BEGIN
                ALTER TABLE ActivityLogs ADD Category NVARCHAR(100) DEFAULT 'General'
            END
            IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'Result' AND Object_ID = Object_ID(N'ActivityLogs'))
            BEGIN
                ALTER TABLE ActivityLogs ADD Result NVARCHAR(50) DEFAULT 'Success'
            END
            IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'OldValues' AND Object_ID = Object_ID(N'ActivityLogs'))
            BEGIN
                ALTER TABLE ActivityLogs ADD OldValues NVARCHAR(MAX) NULL
            END
            IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'NewValues' AND Object_ID = Object_ID(N'ActivityLogs'))
            BEGIN
                ALTER TABLE ActivityLogs ADD NewValues NVARCHAR(MAX) NULL
            END
        `);

    // 8. Admin Requests
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Requests' AND xtype='U')
            CREATE TABLE Requests (
                Id INT PRIMARY KEY IDENTITY(1,1),
                CreatedBy_UserId INT NOT NULL,
                SubDepartmentId INT NULL,
                Title NVARCHAR(255) NOT NULL,
                Content NVARCHAR(MAX) NOT NULL,
                Status NVARCHAR(50) DEFAULT 'new', -- 'new', 'review', 'completed'
                CreatedAt DATETIME DEFAULT GETDATE(),
                FOREIGN KEY (CreatedBy_UserId) REFERENCES Users(Id) ON DELETE NO ACTION
            )
        `);

    // 8.5 System Settings
    await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SystemSettings' AND xtype='U')
            BEGIN
                CREATE TABLE SystemSettings (
                    Id INT PRIMARY KEY IDENTITY(1,1),
                    KeyName NVARCHAR(100) NOT NULL UNIQUE,
                    Value NVARCHAR(MAX) NULL
                );
                INSERT INTO SystemSettings (KeyName, Value) VALUES ('AppLocked', 'false');
            END
        `);


    // 9. Default Departments Seeding
    const depCheck = await request.query(
      `SELECT COUNT(*) as count FROM Departments`,
    );
    if (depCheck.recordset[0].count === 0) {
      await request.query(
        `INSERT INTO Departments (Name) VALUES (N'الاستثمار'), (N'العقار')`,
      );
      const insertedDeps = await request.query(
        `SELECT Id, Name FROM Departments`,
      );
      const invId = insertedDeps.recordset.find(
        (d) => d.Name === "الاستثمار",
      ).Id;
      const realId = insertedDeps.recordset.find((d) => d.Name === "العقار").Id;

      await request.query(`
                INSERT INTO SubDepartments (DepartmentId, Name) VALUES 
                (${invId}, N'الاتصالات'), (${invId}, N'المواعيد'), (${invId}, N'العملاء'),
                (${realId}, N'الاتصالات'), (${realId}, N'المواعيد'), (${realId}, N'العملاء'), (${realId}, N'العقارات'), (${realId}, N'الوكلاء')
            `);
    }
    console.log("ERP Dynamic Tables initialized successfully.");
    isDbReady = true;
  } catch (err) {
    console.warn("Schema initialization warning:", err.message);
    isDbReady = true;
  }
};

module.exports = {
  connectDB,
  getPool,
  getLastDbError,
  getIsDbReady,
  initializeTables,
};
