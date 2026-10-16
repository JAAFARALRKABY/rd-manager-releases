const fs = require("fs");
const path = require("path");
const { app, safeStorage } = require("electron");

let storeFilePath = "";

const initSettings = () => {
  const userDataPath = app.getPath("userData");
  storeFilePath = path.join(userDataPath, "db-settings.enc");
};

const getDbSettings = () => {
  if (!storeFilePath) initSettings();

  try {
    if (fs.existsSync(storeFilePath)) {
      const encryptedData = fs.readFileSync(storeFilePath);
      if (safeStorage.isEncryptionAvailable()) {
        const decryptedData = safeStorage.decryptString(encryptedData);
        return JSON.parse(decryptedData);
      } else {
        console.warn(
          "Encryption not available on this OS, falling back to raw data",
        );
        return JSON.parse(encryptedData.toString("utf8"));
      }
    }
  } catch (err) {
    console.error("Failed to read DB settings:", err);
  }
  return null;
};

const saveDbSettings = (settings) => {
  if (!storeFilePath) initSettings();

  try {
    const jsonStr = JSON.stringify(settings);
    let dataToWrite;

    if (safeStorage.isEncryptionAvailable()) {
      dataToWrite = safeStorage.encryptString(jsonStr);
    } else {
      dataToWrite = Buffer.from(jsonStr, "utf8");
    }

    fs.writeFileSync(storeFilePath, dataToWrite);
    return true;
  } catch (err) {
    console.error("Failed to save DB settings:", err);
    return false;
  }
};

module.exports = {
  getDbSettings,
  saveDbSettings,
};
