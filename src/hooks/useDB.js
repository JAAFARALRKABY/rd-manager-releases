import { useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { getIpcRenderer } from "../utils/ipc";

export const useDB = (user) => {
  // Cache to avoid flash loading on view switches.
  // useRef prevents the cache object from changing identity between renders,
  // which would otherwise cause infinite loops in useEffect dependency arrays.
  const cache = useRef({});
  const inFlight = useRef({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const ipcRenderer = getIpcRenderer();

  const clearCache = useCallback(() => {
    cache.current = {};
    inFlight.current = {};
  }, []);

  // On-Demand Table Fetching
  const fetchTable = useCallback(
    async (table, forceRefresh = false, filters = null) => {
      if (!ipcRenderer || !user) return [];

      // Cache key includes filters to uniquely identify the data subset
      const filterKey = filters ? JSON.stringify(filters) : "all";
      const cacheKey = `${table.toLowerCase()}_${filterKey}`;

      if (!forceRefresh && cache.current[cacheKey]) {
        return cache.current[cacheKey];
      }

      if (inFlight.current[cacheKey]) {
        return inFlight.current[cacheKey];
      }

      const fetchPromise = (async () => {
        setLoading(true);
        setError(null);

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            const actualTable = table.charAt(0).toUpperCase() + table.slice(1);
            const result = await ipcRenderer.invoke("get-table-data", {
              table: actualTable,
              currentUser: user,
              filters,
            });

            if (result.success) {
              const parsedData = result.data.map((item) => {
                if (item.Content && typeof item.Content === "string") {
                  try {
                    item.ParsedContent = JSON.parse(item.Content);
                  } catch {
                    item.ParsedContent = {};
                  }
                }
                return item;
              });
              cache.current[cacheKey] = parsedData;
              return parsedData;
            } else {
              throw new Error(result.error);
            }
          } catch (err) {
            attempts++;
            if (attempts >= maxAttempts) {
              setError(err.message);
              return [];
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      })().finally(() => {
        delete inFlight.current[cacheKey];
        setLoading(false);
      });

      inFlight.current[cacheKey] = fetchPromise;
      return fetchPromise;
    },
    [ipcRenderer, user]
  );

  // Generic Add
  const addRecord = async (table, recordData) => {
    if (!ipcRenderer) return { success: false };
    const result = await ipcRenderer.invoke("add-record", {
      table,
      data: { ...recordData },
      userId: user?.Id,
    });
    if (result.success) {
      // Invalidate basic cache
      await fetchTable(table, true);
      toast.success("تمت إضافة السجل بنجاح");
    } else {
      toast.error("حدث خطأ أثناء الإضافة: " + result.error);
    }
    return result;
  };

  // Generic Update
  const updateRecord = async (table, id, updates) => {
    if (!ipcRenderer) return { success: false };
    const result = await ipcRenderer.invoke("update-record", {
      table,
      id,
      data: updates,
      userId: user?.Id,
    });
    if (result.success) {
      await fetchTable(table, true);
      toast.success("تم تحديث السجل بنجاح");
    } else {
      toast.error("حدث خطأ أثناء التحديث: " + result.error);
    }
    return result;
  };

  // Generic Delete
  const deleteRecord = async (table, id) => {
    if (!ipcRenderer) return { success: false };
    const result = await ipcRenderer.invoke("delete-record", {
      table,
      id,
      userId: user?.Id,
    });
    if (result.success) {
      await fetchTable(table, true);
      toast.success("تم حذف السجل نهائياً بنجاح");
    } else {
      toast.error("حدث خطأ أثناء الحذف: " + result.error);
    }
    return result;
  };

  // File Upload
  const uploadFile = async (fileData, fileName, fileType, recordId = null) => {
    if (!ipcRenderer) return { success: false };
    const result = await ipcRenderer.invoke("upload-file", {
      fileData,
      fileName,
      fileType,
      recordId,
      userId: user?.Id,
    });
    if (!result.success) {
      toast.error("حدث خطأ أثناء رفع الملف: " + result.error);
    }
    return result;
  };

  const deleteFile = async (fileId) => {
    if (!ipcRenderer) return { success: false };
    const result = await ipcRenderer.invoke("delete-file", {
      fileId,
      userId: user?.Id,
    });
    return result;
  };

  const restoreFile = async (fileId) => {
    if (!ipcRenderer) return { success: false };
    const result = await ipcRenderer.invoke("restore-file", {
      fileId,
      userId: user?.Id,
    });
    return result;
  };

  const deleteFilePermanent = async (fileId) => {
    if (!ipcRenderer) return { success: false };
    const result = await ipcRenderer.invoke("delete-file-permanent", {
      fileId,
      userId: user?.Id,
    });
    return result;
  };

  return {
    loading,
    error,
    addRecord,
    updateRecord,
    deleteRecord,
    fetchTable,
    uploadFile,
    deleteFile,
    restoreFile,
    deleteFilePermanent,
    clearCache,
  };
};
