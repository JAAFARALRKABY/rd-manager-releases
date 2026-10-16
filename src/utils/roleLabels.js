/**
 * roleLabels.js — Centralized role label mapping
 *
 * Maps internal Role strings from the database to their Arabic display labels.
 */

/** @type {Record<string, string>} */
const ROLE_LABELS = {
  admin: "المدير العام",
  department_manager: "مسؤول قسم",
  manager: "مسؤول قسم",
  supervisor: "مشرف قسم",
  assistant: "مساعد مدير",
  employee: "موظف",
};

const getRoleLabel = (role) => ROLE_LABELS[role] ?? role ?? "موظف";

/**
 * Returns the full display label for a user, taking call-manager status into account.
 * @param {object} user
 * @returns {string}
 */
export const getUserDisplayLabel = (user) => {
  if (!user) return "";

  let isCallManager = false;
  try {
    const subs =
      typeof user.CallManagerSubs === "string"
        ? JSON.parse(user.CallManagerSubs)
        : user.CallManagerSubs;
    isCallManager = Array.isArray(subs) && subs.length > 0;
  } catch {
    isCallManager = false;
  }

  const baseLabel = getRoleLabel(user.Role);
  if (!isCallManager) return baseLabel;
  return baseLabel === "موظف" ? "مسؤول اتصالات" : `${baseLabel} / مسؤول اتصالات`;
};
