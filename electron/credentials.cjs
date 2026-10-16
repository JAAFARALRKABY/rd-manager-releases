const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Embedded AES-256-GCM encrypted database credentials
// Restricted User: rd_app_user (Limited strictly to RD_FinancialDB operations)
const CIPHERTEXT = "fc9cdfc50d138c6e2164ba4a0cdeb3d328e19cb0029dac4f020af68d3a124e9fb9117fb093f7cf5b78b7ef88966c64ef5771f126cfc566a7876c5b9ae649489641d8572f5e09a68f08e7237016db358de961c16aa3c2960d3cb030d3eef164f4f7c33fd9944ac19b7e7a8d4677f4ec2287aeef29a93e63";
const IV_HEX = "4e55835ef0c56c7e798a900b";
const TAG_HEX = "eb28cfed0be0eb2b8358607b016d6b36";

function decryptEmbeddedConfig() {
  try {
    const key = crypto.scryptSync("RD_Enterprise_Secret_Key_2026_x89", "RD_Salt_99182", 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(IV_HEX, "hex"));
    decipher.setAuthTag(Buffer.from(TAG_HEX, "hex"));
    let decrypted = decipher.update(CIPHERTEXT, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (err) {
    console.error("Failed to decrypt embedded DB credentials:", err);
    return null;
  }
}

/**
 * Returns database configuration securely:
 * 1. Checks environment variables (DB_SERVER_IP, etc.)
 * 2. Checks local .env in development (if exists)
 * 3. Falls back to secure encrypted embedded configuration in production
 */
function getDatabaseConfig(app) {
  const isPackaged = app ? app.isPackaged : false;

  // In production (packaged executable):
  // 1. Delete any leftover legacy plain-text .env file from previous versions (e.g. 1.0.19)
  // 2. Strictly use the tamper-resistant AES-256-GCM encrypted credentials
  if (isPackaged) {
    try {
      const legacyEnvPath = path.join(process.resourcesPath, ".env");
      if (fs.existsSync(legacyEnvPath)) {
        fs.unlinkSync(legacyEnvPath);
        console.log("Legacy .env removed for security");
      }
    } catch (e) {
      // Ignore permission or file lock errors
    }

    // Always return embedded encrypted credentials in production
    return decryptEmbeddedConfig();
  }

  // In development (!isPackaged):
  // Allow local .env file or environment variables for development convenience
  if (process.env.DB_SERVER_IP && process.env.DB_PASSWORD) {
    return {
      serverIp: process.env.DB_SERVER_IP,
      dbName: process.env.DB_NAME || "RD_FinancialDB",
      dbUser: process.env.DB_USER || "rd_app_user",
      dbPassword: process.env.DB_PASSWORD,
    };
  }

  try {
    const devEnvPath = path.join(__dirname, "../.env");
    if (fs.existsSync(devEnvPath)) {
      const lines = fs.readFileSync(devEnvPath, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (key && !(key in process.env)) process.env[key] = val;
      }

      if (process.env.DB_SERVER_IP && process.env.DB_PASSWORD) {
        return {
          serverIp: process.env.DB_SERVER_IP,
          dbName: process.env.DB_NAME || "RD_FinancialDB",
          dbUser: process.env.DB_USER || "rd_app_user",
          dbPassword: process.env.DB_PASSWORD,
        };
      }
    }
  } catch (e) {
    // Silent fallback
  }

  // Fallback to secure embedded encrypted configuration
  return decryptEmbeddedConfig();
}

module.exports = {
  getDatabaseConfig,
};
