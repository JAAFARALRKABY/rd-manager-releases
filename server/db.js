const sql = require("mssql");

const dbConfig = {
  server: process.env.DB_SERVER || "77.83.242.132",
  database: process.env.DB_NAME || "RD_FinancialDB",
  user: process.env.DB_USER || "rd_app_user",
  password: process.env.DB_PASSWORD || "RD_SecureClient_2026_xK9pQ",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    useUTC: false,
  },
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log("✅ [API Server] Successfully connected to MSSQL Database");
    return pool;
  } catch (err) {
    console.error("❌ [API Server] Database connection error:", err.message);
    throw err;
  }
}

function getPool() {
  return pool;
}

module.exports = {
  connectDB,
  getPool,
  sql,
};
