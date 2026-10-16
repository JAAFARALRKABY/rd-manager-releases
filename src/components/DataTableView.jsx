import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Search,
  Filter,
  FileText,
  Download,
  UploadCloud,
  File,
  Paperclip,
  ChevronRight,
  CheckCircle2,
  Edit2,
  RefreshCcw,
  PhoneOff,
  Image,
  X,
  Clock,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBaghdadTime } from "../utils/dateUtils";
import ExportButtons from "./ui/ExportButtons";
import ConfirmModal from "./ui/ConfirmModal";
import SingleRecordExport from "./ui/SingleRecordExport";
import TableForm from "./table/TableForm";
import AttachmentsModal from "./ui/AttachmentsModal";
import SmartFilters from "./table/SmartFilters";
import BulkWhatsAppModal from "./table/BulkWhatsAppModal";
import ViewAllFollowUpsModal from "./table/ViewAllFollowUpsModal";

const DataTableView = ({
  dbTools,
  user,
  subDepartment,
  onBack,
  onTransferCall,
  onTransferToRequested,
  pendingFormData,
  setPendingFormData,
}) => {
  const { fetchTable, addRecord, deleteRecord, uploadFile, loading } = dbTools;
  const [records, setRecords] = useState([]);
  const [files, setFiles] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());
  
  const toggleCard = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Search and Filter States
  const [globalSearch, setGlobalSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [timeFilter, setTimeFilter] = useState("all");
  const [customTimeDays, setCustomTimeDays] = useState("");

  // Dynamic Form State
  const [formData, setFormData] = useState({});
  const [uploading, setUploading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isSubmittingData, setIsSubmittingData] = useState(false);

  const subName = subDepartment?.Name || "";
  const isRealEstate =
    subDepartment?.Name?.includes("عقارات") ||
    subDepartment?.Name?.includes("شقق") ||
    subDepartment?.Name?.includes("أراضي");
  const isFollowUp = subDepartment?.Name?.includes("متابعة");
  const isRequestedComms =
    subDepartment?.Name?.includes("مطلوب") &&
    subDepartment?.Name?.includes("اتصال") && !isFollowUp;
  const isComms = subDepartment?.Name?.includes("اتصالات") && !isFollowUp && !isRequestedComms;
  const isAppt = subDepartment?.Name?.includes("مواعيد");
  const isBrokers = subDepartment?.Name?.includes("وسطاء");
  const isCallManager = useMemo(() => {
    if (!user || !user.CallManagerSubs || !subDepartment) return false;
    try {
      const subs = typeof user.CallManagerSubs === 'string' ? JSON.parse(user.CallManagerSubs) : user.CallManagerSubs;
      if (!Array.isArray(subs) || subs.length === 0) return false;
      
      const sName = subDepartment.Name || "";
      const isGlobalComms = (sName.includes("اتصال") || sName.includes("متابعة") || sName.includes("مطلوب") || sName.includes("مواعيد")) && !sName.includes("عملاء");
      
      return isGlobalComms || subs.includes(subDepartment.Id.toString()) || subs.includes(subDepartment.Id) || subs.includes(Number(subDepartment.Id));
    } catch (e) {
      return false;
    }
  }, [user, subDepartment]);
  const isCustomers = subName.includes("عملا") || subName.includes("عملاء");

  const [isEditing, setIsEditing] = useState(null);
  const [viewAllModal, setViewAllModal] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkProgress, setBulkProgress] = useState(null);
  const [waDelay, setWaDelay] = useState(5);
  const [customWaDelay, setCustomWaDelay] = useState("");
  const [bulkFiles, setBulkFiles] = useState([]);
  const [isDraggingBulk, setIsDraggingBulk] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [allSystemUsers, setAllSystemUsers] = useState([]);
  const [allSubDepartments, setAllSubDepartments] = useState([]);
  const [transferRequestedData, setTransferRequestedData] = useState(null);
  const [transferSelectedUser, setTransferSelectedUser] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const [availableCalls, setAvailableCalls] = useState([]);


  useEffect(() => {
    const loadData = async (forceRefresh) => {
      const users = await fetchTable("Users", forceRefresh);
      setAllSystemUsers(users || []);

      const recs = await fetchTable("Records", forceRefresh);
      let subRecs = recs.filter((r) => r.SubDepartmentId === subDepartment.Id);

      if (subDepartment.Name.includes("موظفين") && forceRefresh) {
        const nonAdminUsers = users.filter((u) => u.Role !== "admin");
        let newlyAdded = false;
        for (const u of nonAdminUsers) {
          const hasRecord = subRecs.some((r) => {
            const d = r.ParsedContent || {};
            return d.systemUserId === u.Id;
          });
          if (!hasRecord) {
            const ipcRenderer = window.require("electron").ipcRenderer;
            const content = JSON.stringify({
              systemUserId: u.Id,
              name: u.FullName || u.Username,
              points: 0,
              contractNumber: "",
              count: "",
            });
            await ipcRenderer.invoke("add-record", {
              table: "Records",
              data: {
                SubDepartmentId: subDepartment.Id,
                CreatedBy_UserId: user.Id,
                SearchIndex: `${u.FullName} ${u.Username}`.toLowerCase(),
                Content: content,
              },
              userId: user.Id,
            });
            newlyAdded = true;
          }
        }
        if (newlyAdded) {
          const freshRecs = await fetchTable("Records", true);
          subRecs = freshRecs.filter(
            (r) => r.SubDepartmentId === subDepartment.Id,
          );
        }
      }

      setRecords(subRecs);

      const allFiles = await fetchTable("Files", forceRefresh);
      setFiles(allFiles.filter((f) => !f.IsDeleted));

      const cats = await fetchTable("CustomCategories", forceRefresh);
      setCustomCategories((cats || []).filter(c => c.SubDepartmentId === subDepartment.Id || c.SubDepartmentId == null));

      const allSubDeps = await fetchTable("SubDepartments", forceRefresh);
      setAllSubDepartments(allSubDeps || []);
      const currentDeptId = subDepartment.DepartmentId;
      const validSubDepIds = allSubDeps
        .filter((s) => s.DepartmentId === currentDeptId)
        .map((s) => s.Id);

      // Extract contacts for autocomplete
      const contacts = [];
      const seenPhones = new Set();
      for (let r of recs) {
        if (!validSubDepIds.includes(r.SubDepartmentId)) continue;
        try {
          const data = r.ParsedContent || {};
          const name = data.name || data.title || data.agentName;
          const phone = data.phone;
          if (name && phone && phone.length >= 10 && !seenPhones.has(phone)) {
            seenPhones.add(phone);
            contacts.push({ name, phone });
          }
        } catch (e) {}
      }
      setAllContacts(contacts);

      if (isFollowUp) {
        const commsSubDep = allSubDeps.find((s) => s.Name === "الاتصالات");
        if (commsSubDep) {
          let calls = recs.filter((r) => r.SubDepartmentId === commsSubDep.Id);
          if (user.Role === "employee" && !isCallManager) {
             calls = calls.filter((r) => r.CreatedBy_UserId === user.Id);
          }
          setAvailableCalls(calls);
        }
      }
    };

    const load = async () => {
      if (!subDepartment) return;
      // 1. Instant load from cache
      await loadData(false);
      // 2. Background refresh
      loadData(true).catch(console.error);
    };
    load();
  }, [subDepartment, fetchTable]);

  useEffect(() => {
    if (pendingFormData && (isComms || isRequestedComms)) {
      setFormData(pendingFormData);
      setIsAdding(true);
      if (setPendingFormData) setPendingFormData(null);
    }
  }, [pendingFormData, isComms, isRequestedComms, setPendingFormData]);

  const handleFileSelect = async (e) => {
    if (e.preventDefault) e.preventDefault();

    // Extract data synchronously to avoid React synthetic event nullification
    let fileList = [];
    let htmlData = "";
    let urlData = "";
    const hasDataTransfer = !!e.dataTransfer;

    if (
      e.clipboardData &&
      e.clipboardData.files &&
      e.clipboardData.files.length > 0
    ) {
      fileList = Array.from(e.clipboardData.files);
    } else if (
      e.dataTransfer &&
      e.dataTransfer.files &&
      e.dataTransfer.files.length > 0
    ) {
      fileList = Array.from(e.dataTransfer.files);
    } else if (e.target && e.target.files && e.target.files.length > 0) {
      fileList = Array.from(e.target.files);
    }

    if (hasDataTransfer) {
      htmlData = e.dataTransfer.getData("text/html");
      urlData =
        e.dataTransfer.getData("text/uri-list") ||
        e.dataTransfer.getData("text/plain");
    }

    const toast = (await import("react-hot-toast")).default;
    const newAttached = [...attachedFiles];

    // 1. Process local files or pasted files
    if (fileList.length > 0) {
      setUploading(true);
      const uploadPromises = fileList.map((file) => {
        return new Promise((resolve) => {
          const fileType = file.type || "";
          if (
            !fileType.startsWith("image/") &&
            !fileType.startsWith("video/") &&
            !file.name.match(/\.(jpg|jpeg|png|gif|mp4|webm|mkv)$/i)
          ) {
            toast.error(
              `عذراً، الملف "${file.name || "مجهول"}" غير مسموح. يمكن إرفاق الصور والفيديوهات فقط لدواعي أمنية.`,
            );
            return resolve(null);
          }
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const base64Data = event.target.result;
              const res = await uploadFile(
                base64Data,
                file.name ||
                  `paste_${Date.now()}.${file.type.split("/")[1] || "jpg"}`,
                file.type,
                null,
              );
              if (res.success) {
                resolve({
                  id: res.id,
                  name: res.name || file.name || "مرفق",
                  path: res.path,
                  type: file.type,
                });
              } else resolve(null);
            } catch (err) {
              resolve(null);
            }
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      });

      const results = await Promise.all(uploadPromises);
      const validResults = results.filter((r) => r !== null);
      if (validResults.length > 0) {
        setAttachedFiles((prev) => [...prev, ...validResults]);
      }
      setUploading(false);
    }
    // 2. Process Dragged URLs
    else if (hasDataTransfer) {
      let imgUrl = "";
      if (htmlData) {
        const match = htmlData.match(/src\s*=\s*"([^"]+)"/);
        if (match) imgUrl = match[1];
      }
      if (!imgUrl) imgUrl = urlData;

      if (
        imgUrl &&
        (imgUrl.startsWith("http") || imgUrl.startsWith("data:image/"))
      ) {
        setUploading(true);
        const toastId = toast.loading("جاري سحب وتنزيل الصورة...");
        const ipcRenderer = window.require("electron").ipcRenderer;
        const res = await ipcRenderer.invoke("download-temp-file", imgUrl);
        toast.dismiss(toastId);

        if (res.success) {
          try {
            const fs = window.require("fs");
            const buffer = fs.readFileSync(res.path);
            const base64Data = `data:${res.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
            const uploadRes = await uploadFile(
              base64Data,
              res.name,
              res.type || "image/jpeg",
              null,
            );

            if (uploadRes.success) {
              newAttached.push({
                id: uploadRes.id,
                name: res.name,
                path: uploadRes.path,
                type: res.type || "image/jpeg",
              });
              setAttachedFiles([...newAttached]);
            }
          } catch (err) {
            toast.error("حدث خطأ أثناء معالجة الصورة المسحوبة.");
          }
        } else {
          toast.error("لم نتمكن من سحب الصورة.");
        }
        setUploading(false);
      }
    }
  };

  const handleRemoveFile = (idOrIndex) => {
    setAttachedFiles((prev) =>
      prev.filter((f, i) => f.id !== idOrIndex && i !== idOrIndex),
    );
  };

  const handleRemoveBulkFile = (idOrIndex) => {
    setBulkFiles((prev) =>
      prev.filter((f, i) => f.id !== idOrIndex && i !== idOrIndex),
    );
  };

  const confirmModalAsync = (title, message, confirmText, type = "danger") => {
    return new Promise((resolve) => {
      setConfirmConfig({
        title,
        message,
        confirmText,
        type,
        onConfirm: () => {
          setConfirmConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(null);
          resolve(false);
        },
      });
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingData) return;
    setIsSubmittingData(true);

    try {
      // Phone validation
      for (let key in formData) {
        if (
          key.toLowerCase().includes("phone") &&
          formData[key] &&
          formData[key].length > 0 &&
          formData[key].length !== 11
        ) {
          import("react-hot-toast").then((module) =>
            module.default.error("رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط"),
          );
          return;
        }
      }

      // Duplicate Check for Phone Number across all sections
      if (formData.phone) {
        let shouldBlock = false;
        let customError =
          "عذراً، هذا الرقم موجود مسبقاً في هذا القسم! لا يمكن التكرار.";
        const cleanFormPhone = formData.phone.replace(/\D/g, "");

        const existingRecord = records.find((r) => {
          let c = r.ParsedContent || {};
          const cleanExistingPhone = (c.phone || "").replace(/\D/g, "");
          return cleanExistingPhone === cleanFormPhone && r.Id !== isEditing;
        });

        if (existingRecord) {
          if (!isEditing) {
            const proceed = await confirmModalAsync(
              "تنبيه: تكرار رقم الهاتف",
              "هذا الرقم مسجل مسبقاً في هذا القسم. هل تريد الإضافة على أية حال؟",
              "نعم، تأكيد الإضافة",
              "warning",
            );
            if (!proceed) {
              shouldBlock = true;
              customError = "تم إلغاء الإضافة.";
            }
          }
        }

        if (shouldBlock) {
          import("react-hot-toast").then((module) =>
            module.default.error(customError),
          );
          setIsSubmittingData(false);
          return;
        }
      }

      const finalFormData = { ...formData };

      if (finalFormData.category === "مخصص" && finalFormData.customCategory) {
        const check = customCategories.find(
          (c) => c.Name === finalFormData.customCategory,
        );
        if (!check) {
          await addRecord("CustomCategories", {
            Name: finalFormData.customCategory,
            SubDepartmentId: subDepartment.Id
          });
          setCustomCategories([
            ...customCategories,
            { Name: finalFormData.customCategory, SubDepartmentId: subDepartment.Id },
          ]);
        }
        finalFormData.category = finalFormData.customCategory;
        delete finalFormData.customCategory;
      }

      if (finalFormData.result === "مخصص" && finalFormData.customResult) {
        const check = customCategories.find(
          (c) => c.Name === finalFormData.customResult,
        );
        if (!check) {
          await addRecord("CustomCategories", {
            Name: finalFormData.customResult,
            SubDepartmentId: subDepartment.Id
          });
          setCustomCategories([
            ...customCategories,
            { Name: finalFormData.customResult, SubDepartmentId: subDepartment.Id },
          ]);
        }
        finalFormData.result = finalFormData.customResult;
        delete finalFormData.customResult;
      }

      if (isCustomers && !finalFormData.callDate) {
        finalFormData.callDate = new Date().toISOString().split("T")[0];
      }
      if (isComms && !finalFormData.contactDate) {
        finalFormData.contactDate = new Date().toISOString().split("T")[0];
      }
      if (isAppt) {
        if (!finalFormData.datetime) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          finalFormData.datetime = now.toISOString().slice(0, 16);
        }
        if (finalFormData.reminder === "custom") {
          finalFormData.reminder = finalFormData.customReminder || "0";
        }
      }

      const defaultStatus = isComms ? "تم الاتصال" : "قيد الانتظار";
      const callStatus = finalFormData.status || defaultStatus;
      
      const originalRequestId = finalFormData.requestId;
      const originalDeleteId = finalFormData.deleteOriginalId;
      
      delete finalFormData.requestId; // Don't save this in the call log itself
      delete finalFormData.deleteOriginalId; // Don't save this either

      // Make sure status is actually saved in the call log if it's a comms record
      if ((isComms || isRequestedComms) && !finalFormData.status) {
        finalFormData.status = callStatus;
      }

      const searchIndex = Object.values(finalFormData).join(" ").toLowerCase();

      if (isEditing) {
        const ipcRenderer = window.require("electron").ipcRenderer;
        const res = await ipcRenderer.invoke("update-record", {
          table: "Records",
          id: isEditing,
          userId: user.Id,
          data: {
            SearchIndex: searchIndex,
            Content: JSON.stringify(finalFormData),
          },
        });
        if (res.success) {
          if (attachedFiles.length > 0) {
            for (let f of attachedFiles) {
              await ipcRenderer.invoke("update-record", {
                table: "Files",
                id: f.id,
                data: { RecordId: isEditing },
              });
            }
          }
          setFormData({});
          setAttachedFiles([]);
          setIsAdding(false);
          setIsEditing(null);

          const recs = await fetchTable("Records", true);
          setRecords(
            recs.filter((r) => r.SubDepartmentId === subDepartment.Id),
          );
          const allFiles = await fetchTable("Files", true);
          setFiles(allFiles.filter((f) => !f.IsDeleted));
        }
      } else {
        const shouldSkipSave =
          originalRequestId &&
          (callStatus === "إعادة اتصال" || callStatus === "غير متوفر");
        let result = { success: true, id: null };

        if (!shouldSkipSave) {
          result = await addRecord("Records", {
            SubDepartmentId: subDepartment.Id,
            CreatedBy_UserId: user.Id,
            SearchIndex: searchIndex,
            Content: JSON.stringify(finalFormData),
          });
        }

        if (result.success) {
          const recordId = result.id;
          if (attachedFiles.length > 0) {
            const ipcRenderer = window.require("electron").ipcRenderer;
            for (let f of attachedFiles) {
              await ipcRenderer.invoke("update-record", {
                table: "Files",
                id: f.id,
                data: { RecordId: recordId },
              });
            }
            
            // Move existing files to the new record if deleteOriginalId is present
            if (originalDeleteId) {
              const allFilesRes = await ipcRenderer.invoke("get-table-data", { table: "Files" });
              if (allFilesRes.success && Array.isArray(allFilesRes.data)) {
                const orgFiles = allFilesRes.data.filter(f => f.RecordId === originalDeleteId && !f.IsDeleted);
                for (let f of orgFiles) {
                  await ipcRenderer.invoke("update-record", {
                    table: "Files",
                    id: f.Id,
                    data: { RecordId: recordId }
                  });
                }
              }
            }
          }

          if (originalRequestId && callStatus) {
            const ipcRenderer = window.require("electron").ipcRenderer;
            const resOrg = await ipcRenderer.invoke("get-table-data", {
              table: "Records",
            });
            if (resOrg.success && resOrg.data) {
              const orgRecord = resOrg.data.find(
                (r) => r.Id === originalRequestId,
              );
              if (orgRecord) {
                try {
                  let orgContent = JSON.parse(orgRecord.Content || "{}");
                  orgContent.status = callStatus;
                  await ipcRenderer.invoke("update-record", {
                    table: "Records",
                    id: originalRequestId,
                    userId: user.Id,
                    data: { Content: JSON.stringify(orgContent) },
                  });
                } catch (e) {
                  console.error("Failed to update original request record:", e);
                }
              }
            }
            if (typeof setPendingFormData === "function")
              setPendingFormData(null);
          }

          if (originalDeleteId) {
            const ipcRenderer = window.require("electron").ipcRenderer;
            await ipcRenderer.invoke("delete-record", {
              table: "Records",
              id: originalDeleteId,
              userId: user.Id,
            });
            if (typeof setPendingFormData === "function")
              setPendingFormData(null);
          }

          setFormData({});
          setAttachedFiles([]);
          setIsAdding(false);

          const recs = await fetchTable("Records", true);
          setRecords(
            recs.filter((r) => r.SubDepartmentId === subDepartment.Id),
          );
          const allFiles = await fetchTable("Files", true);
          setFiles(allFiles.filter((f) => !f.IsDeleted));
        }
      }
    } finally {
      setIsSubmittingData(false);
    }
  };

  const updateEmployeePoints = async (rec, delta) => {
    let parsed = rec.ParsedContent || {};
    const currentPoints = parseInt(parsed.points) || 0;
    parsed.points = currentPoints + delta;

    const ipcRenderer = window.require("electron").ipcRenderer;
    const res = await ipcRenderer.invoke("update-record", {
      table: "Records",
      id: rec.Id,
      data: {
        Content: JSON.stringify(parsed),
      },
      userId: user.Id,
    });
    if (res.success) {
      const recs = await fetchTable("Records", true);
      setRecords(recs.filter((r) => r.SubDepartmentId === subDepartment.Id));
    } else {
      import("react-hot-toast").then((module) =>
        module.default.error("حدث خطأ أثناء حفظ النقاط: " + res.error),
      );
    }
  };

  const handleDelete = useCallback(
    (id) => {
      setConfirmConfig({
        title: "تأكيد حذف السجل",
        message: "هل أنت متأكد من حذف هذا السجل؟",
        confirmText: "تأكيد",
        onConfirm: () => {
          setConfirmConfig({
            title: "تأكيد نهائي ⚠️",
            message:
              "تحذير نهائي: هذا السجل (مع كافة مرفقاته) سيتم مسحه تماماً من النظام ولن تتمكن من استرجاعه أبداً. هل أنت متأكد؟",
            confirmText: "نعم، احذف نهائياً",
            onConfirm: async () => {
              setConfirmConfig(null);
              await deleteRecord("Records", id);
              const recs = await fetchTable("Records", true);
              setRecords(
                recs.filter((r) => r.SubDepartmentId === subDepartment.Id),
              );
            },
            onCancel: () => setConfirmConfig(null),
          });
        },
        onCancel: () => setConfirmConfig(null),
      });
    },
    [deleteRecord, fetchTable, subDepartment],
  );

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (
        selectedEmployeeId !== "all" &&
        rec.CreatedBy_UserId !== selectedEmployeeId
      ) {
        return false;
      }

      let content = rec.ParsedContent || {};

      // Handle assigned requests restriction
      if (content.assignedToUserId && content.assignedToUserId !== "") {
        const hasElevatedAccess = user && (user.Role === "admin" || user.Role === "assistant" || user.Role === "department_manager" || user.Role === "supervisor" || isCallManager);
        const isAssignedToMe = user && String(content.assignedToUserId) === String(user.Id);
        const isCreatedByMe = user && String(rec.CreatedBy_UserId) === String(user.Id);
        if (!hasElevatedAccess && !isAssignedToMe && !isCreatedByMe) {
          return false;
        }
      }

      // Time Filter based on CreatedAt
      if (timeFilter !== "all") {
        const createdDate = new Date(rec.CreatedAt);
        const now = new Date();
        const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);

        if (timeFilter === "3days" && diffDays > 3) return false;
        if (timeFilter === "1week" && diffDays > 7) return false;
        if (timeFilter === "2weeks" && diffDays > 14) return false;
        if (timeFilter === "1month" && diffDays > 30) return false;
        if (timeFilter === "custom" && customTimeDays) {
          const maxDays = parseInt(customTimeDays);
          if (!isNaN(maxDays) && diffDays > maxDays) return false;
        }
      }

      if (globalSearch) {
        const term = globalSearch.toLowerCase();
        if (
          !rec.SearchIndex?.toLowerCase().includes(term) &&
          !JSON.stringify(content).toLowerCase().includes(term)
        ) {
          return false;
        }
      }

      if (
        filters.city &&
        (!content.city || !content.city.includes(filters.city))
      )
        return false;
      if (
        filters.area &&
        (!content.area || !content.area.includes(filters.area))
      )
        return false;
      if (
        filters.type &&
        (!content.type || !content.type.includes(filters.type))
      )
        return false;
      if (
        filters.realEstateStatus &&
        content.realEstateStatus !== filters.realEstateStatus
      )
        return false;
      if (
        filters.minPrice &&
        Number(content.price || 0) < Number(filters.minPrice)
      )
        return false;
      if (
        filters.maxPrice &&
        Number(content.price || 0) > Number(filters.maxPrice)
      )
        return false;

      if (filters.category) {
        const cat =
          content.category === "مخصص"
            ? content.customCategory
            : content.category;
        if (cat !== filters.category) return false;
      }
      if (filters.result) {
        const res =
          content.result === "مخصص" ? content.customResult : content.result;
        if (res !== filters.result) return false;
      }

      if (filters.requestedStatus) {
        if (filters.requestedStatus === "مطلوب") {
          if (content.status && content.status !== "مطلوب") return false;
        } else {
          if (content.status !== filters.requestedStatus) return false;
        }
      }

      return true;
    });
  }, [
    records,
    globalSearch,
    filters,
    timeFilter,
    customTimeDays,
    selectedEmployeeId,
  ]);

  useEffect(() => {
    setVisibleCount(50);
  }, [filteredRecords]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredRecords.map((r) => r.Id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRecord = (id) => {
    if (selectedIds.includes(id))
      setSelectedIds(selectedIds.filter((i) => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const startBulkWhatsApp = async () => {
    if (!bulkMessage.trim()) return;

    const ipcRenderer = window.require("electron").ipcRenderer;
    const targets = filteredRecords.filter((r) => selectedIds.includes(r.Id));
    const total = targets.length;

    let successCount = 0;
    for (let i = 0; i < total; i++) {
      const r = targets[i];
      let c = r.ParsedContent || {};
      const phone = c.phone || "";

      if (phone.length === 11) {
        setBulkProgress(
          `جاري المعالجة ${i + 1} من ${total}... (يتم إرسال الرسالة آلياً)`,
        );

        const url = `whatsapp://send?phone=964${phone.substring(1)}&text=${encodeURIComponent(bulkMessage)}`;
        await ipcRenderer.invoke("open-external-url", url);

        // Wait X seconds for WhatsApp Desktop to load the chat
        const delayValue =
          waDelay === "custom"
            ? Math.max(1, parseInt(customWaDelay) || 5)
            : waDelay;
        await new Promise((res) => setTimeout(res, delayValue * 1000));

        // Extract file paths from attachments
        const filePaths = bulkFiles.map((f) => f.path);

        // Simulate WhatsApp Send (Pastes images if exist, then hits enter)
        await ipcRenderer.invoke("simulate-whatsapp-send", filePaths);

        successCount++;
        // Wait briefly before next
        if (i < total - 1) {
          await new Promise((res) => setTimeout(res, 1000));
        }
      }
    }

    setBulkProgress(null);
    setShowBulkModal(false);
    setBulkFiles([]);
    import("react-hot-toast").then((module) =>
      module.default.success(
        `اكتملت العملية، تم توجيه ${successCount} رسالة للواتساب`,
      ),
    );
  };

  const handleBulkDrop = async (e) => {
    if (e.preventDefault) e.preventDefault();
    setIsDraggingBulk(false);

    // Extract data synchronously
    let fileList = [];
    let htmlData = "";
    let urlData = "";
    const hasDataTransfer = !!e.dataTransfer;

    if (
      e.clipboardData &&
      e.clipboardData.files &&
      e.clipboardData.files.length > 0
    ) {
      fileList = Array.from(e.clipboardData.files);
    } else if (
      e.dataTransfer &&
      e.dataTransfer.files &&
      e.dataTransfer.files.length > 0
    ) {
      fileList = Array.from(e.dataTransfer.files);
    } else if (e.target && e.target.files && e.target.files.length > 0) {
      fileList = Array.from(e.target.files);
    }

    if (hasDataTransfer) {
      htmlData = e.dataTransfer.getData("text/html");
      urlData =
        e.dataTransfer.getData("text/uri-list") ||
        e.dataTransfer.getData("text/plain");
    }

    const ipcRenderer = window.require("electron").ipcRenderer;
    const toast = (await import("react-hot-toast")).default;

    let newFiles = [];

    // 1. Process local or pasted files
    if (fileList.length > 0) {
      const toastId = toast.loading("جاري تجهيز المرفقات...");
      const processPromises = fileList.map((f) => {
        return new Promise((resolve) => {
          const fileType = f.type || "";
          if (
            fileType.startsWith("image/") ||
            fileType.startsWith("video/") ||
            f.name.match(/\.(jpg|jpeg|png|gif|mp4|webm|mkv)$/i)
          ) {
            if (f.path) {
              resolve({ name: f.name, path: f.path, type: fileType });
            } else {
              // File from clipboard has no path, read it and save to temp
              const reader = new FileReader();
              reader.onload = async (event) => {
                try {
                  const res = await ipcRenderer.invoke(
                    "save-temp-blob",
                    event.target.result,
                    f.name,
                    fileType || "image/png",
                  );
                  if (res.success) {
                    resolve({ name: res.name, path: res.path, type: res.type });
                  } else resolve(null);
                } catch (err) {
                  resolve(null);
                }
              };
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(f);
            }
          } else {
            resolve(null);
          }
        });
      });

      const results = await Promise.all(processPromises);
      const validResults = results.filter((r) => r !== null);
      newFiles.push(...validResults);
      toast.dismiss(toastId);
    }
    // 2. Check for dragged URLs or images from browser
    else if (hasDataTransfer) {
      let imgUrl = "";
      if (htmlData) {
        const match = htmlData.match(/src\s*=\s*"([^"]+)"/);
        if (match) imgUrl = match[1];
      }
      if (!imgUrl) imgUrl = urlData;

      if (
        imgUrl &&
        (imgUrl.startsWith("http") || imgUrl.startsWith("data:image/"))
      ) {
        const toastId = toast.loading("جاري سحب وتنزيل الصورة...");
        const res = await ipcRenderer.invoke("download-temp-file", imgUrl);
        toast.dismiss(toastId);
        if (res.success) {
          newFiles.push({
            name: res.name,
            path: res.path,
            type: res.type || "image/jpeg",
          });
        } else {
          toast.error("لم نتمكن من سحب الصورة.");
        }
      }
    }

    if (newFiles.length > 0) {
      setBulkFiles((prev) => [...prev, ...newFiles]);
    }
  };

  useEffect(() => {
    if (!showBulkModal) return;
    const handleGlobalBulkPaste = (e) => {
      if (
        e.clipboardData &&
        e.clipboardData.files &&
        e.clipboardData.files.length > 0
      ) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
          handleBulkDrop(e);
        }
      }
    };
    document.addEventListener("paste", handleGlobalBulkPaste);
    return () => {
      document.removeEventListener("paste", handleGlobalBulkPaste);
    };
  }, [showBulkModal, handleBulkDrop]);

  return (
    <div className="space-y-8 animate-fade-in pb-10" id="export-section">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 no-print glass-panel p-6 rounded-[2rem]">
        <div className="flex items-center gap-5">
          <button
            onClick={onBack}
            className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all hover:-translate-x-1"
          >
            <ChevronRight size={20} />
          </button>
          <div>
            <h2 className="text-3xl font-bold gradient-text pb-1">
              {subDepartment?.Name}
            </h2>
            <p className="text-sm font-bold text-slate-400">
              إجمالي السجلات المتاحة:{" "}
              <span className="text-blue-400">{filteredRecords.length}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search
              className="absolute right-4 top-3.5 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="بحث ذكي شامل..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="premium-input pr-12 rounded-full"
            />
          </div>

          {(user.Role === "admin" || user.Role === "manager" || user.Role === "department_manager" || user.Role === "supervisor" || isCallManager) && records.length > 0 && (
            <div className="relative md:w-56 z-[60]">
              <select
                value={selectedEmployeeId}
                onChange={(e) =>
                  setSelectedEmployeeId(
                    e.target.value === "all" ? "all" : parseInt(e.target.value),
                  )
                }
                className="premium-input rounded-full appearance-none pr-4 pl-10"
              >
                <option value="all">كل موظفي القسم</option>
                {Array.from(
                  new Set(records.map((r) => r.CreatedBy_UserId)),
                ).map((userId) => {
                  const emp = allSystemUsers.find((u) => u.Id === userId);
                  if (!emp || emp.Role === "admin") return null; // Only show actual employees
                  return (
                    <option key={userId} value={userId}>
                      {emp.FullName || emp.Username}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <ExportButtons
            elementId="export-section"
            filename={subDepartment?.Name}
            records={
              !isFollowUp ? filteredRecords : filteredRecords.map(rec => {
                 let d = rec.ParsedContent || {};
                 let resolvedName = d.callRecordId;
                 if (d.callRecordId && availableCalls) {
                    const call = availableCalls.find(c => c.Id.toString() === d.callRecordId.toString());
                    if (call) {
                       const callData = call.ParsedContent || {};
                       const title = callData.name || callData.title || callData.agentName || callData.sellerName || "بدون اسم";
                       const phone = callData.phone || "";
                       resolvedName = `${title} ${phone ? `- ${phone}` : ""}`;
                    }
                 }
                 return {
                    ...rec,
                    Content: JSON.stringify({...d, callRecordId: resolvedName})
                 };
              })
            }
            subName={subName}
            user={user}
            allSystemUsers={allSystemUsers}
            beforeExport={async () => {
              if (visibleCount < filteredRecords.length) {
                setVisibleCount(filteredRecords.length);
                await new Promise((r) => setTimeout(r, 1000));
              }
            }}
          />

          {filteredRecords.length > 0 && (
            <button
              onClick={() => {
                if (selectedIds.length === filteredRecords.length)
                  setSelectedIds([]);
                else setSelectedIds(filteredRecords.map((r) => r.Id));
              }}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold shadow-lg transition-all"
            >
              {selectedIds.length === filteredRecords.length
                ? "إلغاء التحديد"
                : "تحديد الكل"}
            </button>
          )}

          {visibleCount < filteredRecords.length && (
            <button
              onClick={() => setVisibleCount(filteredRecords.length)}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-full font-bold shadow-lg transition-all border border-blue-500/30 no-print"
            >
              عرض الكل ({filteredRecords.length})
            </button>
          )}

          {filteredRecords.length > 0 && (
            <button
              onClick={() => {
                if (expandedCards.size > 0) {
                  setExpandedCards(new Set());
                } else {
                  setExpandedCards(new Set(filteredRecords.map(r => {
                    if (isFollowUp) {
                      return r.ParsedContent?.callRecordId || "unknown";
                    }
                    return r.Id;
                  })));
                }
              }}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-full font-bold shadow-lg transition-all border border-blue-500/30 no-print flex items-center gap-2"
            >
              {expandedCards.size > 0 ? "طي الكل" : "توسيع الكل"}
            </button>
          )}

          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="glow-button flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full font-bold shadow-lg animate-fade-in"
            >
              رسالة جماعية ({selectedIds.length})
            </button>
          )}

          {user.Role !== "assistant" &&
            (!isRequestedComms ||
              isCallManager ||
              user.Role === "admin") && (
              <button
                onClick={() => {
                  if (isAdding && !isEditing) {
                    setIsAdding(false);
                  } else {
                    setFormData({});
                    setIsEditing(null);
                    setIsAdding(true);
                  }
                }}
                className="glow-button flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-bold shadow-lg"
              >
                <Plus size={20} /> إضافة سجل
              </button>
            )}
        </div>
      </div>

      {/* ─── Smart Filters ────────────────────────────────────────────────── */}
      <SmartFilters
        isRealEstate={isRealEstate}
        isCustomers={isCustomers}
        isComms={isComms}
        isRequestedComms={isRequestedComms}
        isAdding={isAdding}
        filters={filters}
        setFilters={setFilters}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        customTimeDays={customTimeDays}
        setCustomTimeDays={setCustomTimeDays}
        customCategories={customCategories}
      />

      {/* Dynamic Add Form */}
      <TableForm
        isAdding={isAdding}
        handleSubmit={handleSubmit}
        isRealEstate={isRealEstate}
        isRequestedComms={isRequestedComms}
        isFollowUp={isFollowUp}
        isComms={isComms}
        isAppt={isAppt}
        isBrokers={isBrokers}
        isCustomers={isCustomers}
        formData={formData}
        setFormData={setFormData}
        allContacts={allContacts}
        availableCalls={availableCalls}
        allSystemUsers={allSystemUsers}
        subDepartment={subDepartment}
        customCategories={customCategories}
        uploading={uploading}
        attachedFiles={attachedFiles}
        handleFileSelect={handleFileSelect}
        onRemoveFile={handleRemoveFile}
        isSubmittingData={isSubmittingData}
        existingFiles={isEditing ? files.filter(f => f.RecordId === isEditing) : []}
        onRemoveExistingFile={async (fileId) => {
          try {
            const { ipcRenderer } = window.require("electron");
            const res = await ipcRenderer.invoke("delete-file", { fileId, userId: user.Id });
            if (res.success) {
              setFiles(files.filter(f => f.Id !== fileId));
              import("react-hot-toast").then(m => m.default.success("تم نقل المرفق للمهملات"));
            } else {
              import("react-hot-toast").then(m => m.default.error(res.error || "فشل الحذف"));
            }
          } catch (e) {
            console.error(e);
            import("react-hot-toast").then(m => m.default.error("حدث خطأ أثناء الحذف"));
          }
        }}
        onAttachmentsModalClose={() => loadData()}
      />

      {/* Data Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecords.length === 0 ? (
          <div className="col-span-full text-center p-16 glass-panel rounded-[2rem]">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-slate-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              لا توجد بيانات مطابقة
            </h3>
            <p className="text-slate-400">
              جرب البحث بكلمات أخرى أو قم بمسح الفلاتر.
            </p>
          </div>
        ) : isFollowUp ? (
          Object.values(filteredRecords.reduce((acc, rec) => {
            const data = rec.ParsedContent || {};
            const callId = data.callRecordId || "unknown";
            if (!acc[callId]) {
              acc[callId] = {
                 callRecordId: callId,
                 call: availableCalls?.find(c => c.Id.toString() === callId.toString()),
                 followUps: []
              };
            }
            acc[callId].followUps.push({ rec, data });
            return acc;
          }, {})).slice(0, visibleCount).map(group => {
            const callData = group.call?.ParsedContent || {};
            const title = callData.name || callData.title || callData.agentName || "متابعات بدون اتصال صالح";
            const phone = callData.phone || "";
            return (
              <div key={group.callRecordId} className="glass-panel p-7 rounded-[2rem] flex flex-col relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-full h-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{background: "linear-gradient(90deg, transparent, #3b82f6, #6366f1)"}}></div>
                 <div className="flex justify-between items-start mb-6 relative z-10">
                    <h3 className="font-extrabold text-2xl text-white leading-tight pr-3 border-r-4 border-blue-500">
                      {title} {phone ? `- ${phone}` : ""}
                    </h3>
                    <div className="flex items-center gap-3">
                       <button
                         onClick={() => toggleCard(group.callRecordId)}
                         className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600/10 hover:bg-blue-600/30 text-blue-400 hover:text-white rounded-xl transition-all border border-blue-500/20 font-bold text-xs shadow-sm"
                       >
                         {expandedCards.has(group.callRecordId) ? "طي" : "عرض التفاصيل"}
                         <ChevronDown size={16} className={`transition-transform duration-300 ${expandedCards.has(group.callRecordId) ? "rotate-180" : ""}`} />
                       </button>
                       <ExportButtons
                         elementId={`export-group-${group.callRecordId}`}
                         filename={`متابعات_${title.replace(/\s+/g, "_")}`}
                         records={group.followUps.map(f => ({...f.rec, Content: JSON.stringify({...f.data, callRecordId: `${title} ${phone ? `- ${phone}` : ""}`})}))}
                         subName={subDepartment?.Name || "متابعة"}
                         user={user}
                         allSystemUsers={allSystemUsers}
                       />
                       {(user.Role === "admin" || isCallManager) && (
                          <button
                            onClick={() => {
                              setConfirmConfig({
                                title: "مسح جميع متابعات العميل",
                                message: `هل أنت متأكد من مسح جميع متابعات "${title}" نهائياً؟`,
                                confirmText: "مسح الكل",
                                onConfirm: async () => {
                                  setConfirmConfig(null);
                                  let successCount = 0;
                                  for (const f of group.followUps) {
                                     const res = await deleteRecord("Records", f.rec.Id);
                                     if(res.success) successCount++;
                                  }
                                  if (successCount > 0) {
                                     toast.success(`تم مسح ${successCount} متابعات بنجاح`);
                                     const idsToDelete = group.followUps.map(f => f.rec.Id);
                                     setRecords(prev => prev.filter(r => !idsToDelete.includes(r.Id)));
                                  }
                                },
                                onCancel: () => setConfirmConfig(null)
                              });
                            }}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700 hover:border-red-500/50 shadow-sm text-xs font-bold no-print"
                          >
                            <Trash2 size={16} /> <span className="hidden sm:inline">مسح الكل</span>
                          </button>
                       )}
                    </div>
                 </div>
                 
                 <AnimatePresence>
                   {expandedCards.has(group.callRecordId) && (
                     <motion.div
                       initial={{ height: 0, opacity: 0 }}
                       animate={{ height: "auto", opacity: 1 }}
                       exit={{ height: 0, opacity: 0 }}
                       className="overflow-hidden"
                     >
                       <div className="space-y-4 relative z-10 pt-4 border-t border-white/5 mt-4">
                          {group.followUps.slice(0, 3).map(f => (
                             <div key={f.rec.Id} className="bg-slate-900/40 p-5 rounded-xl border border-white/5 flex flex-col gap-2 relative group/item hover:border-blue-500/30 transition-all">
                               <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                   <div className="flex items-center gap-2">
                                     <span className="text-lg font-bold text-blue-400">{f.data.followUpType}</span>
                                     <span className="text-[10px] text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded border border-white/5 whitespace-nowrap flex items-center gap-1">
                                       <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                       {(() => {
                                         const cObj = allSystemUsers?.find(u => u.Id === f.rec.CreatedBy_UserId);
                                         return cObj ? (cObj.FullName || cObj.Username) : "مجهول";
                                       })()}
                                     </span>
                                   </div>
                                   <span className="text-sm font-mono text-slate-400">{f.data.followUpDate}</span>
                                </div>
                               <div className="text-slate-200 text-sm mt-2 whitespace-pre-wrap">{f.data.details}</div>
                               {(user.Role === "admin" || (user.Role === "employee" && f.rec.CreatedBy_UserId === user.Id) || isCallManager) && (
                                 <div className="absolute top-2 left-2 flex gap-2 no-print opacity-0 group-hover/item:opacity-100 transition-opacity">
                                    <button onClick={() => { setFormData(f.data); setIsEditing(f.rec.Id); setIsAdding(true); document.querySelector(".overflow-auto")?.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-slate-500 hover:text-blue-400 p-1.5 bg-slate-900 rounded-lg hover:bg-white/5"><Edit2 size={16}/></button>
                                    <button onClick={() => handleDelete(f.rec.Id)} className="text-slate-500 hover:text-red-400 p-1.5 bg-slate-900 rounded-lg hover:bg-white/5"><Trash2 size={16}/></button>
                                 </div>
                               )}
                             </div>
                          ))}
                          
                          {group.followUps.length > 3 && (
                             <button 
                               onClick={() => setViewAllModal({group, title, phone})}
                               className="w-full cursor-pointer text-center text-blue-400 font-bold bg-blue-500/10 hover:bg-blue-500/20 py-3 rounded-xl transition-colors outline-none block"
                             >
                               عرض جميع المتابعات السابقة ({group.followUps.length - 3})
                             </button>
                          )}
                       </div>
                     </motion.div>
                   )}
                 </AnimatePresence>
              </div>
            );
          })
        ) : (
          filteredRecords.slice(0, visibleCount).map((rec, index) => {
            let data = rec.ParsedContent || {};

            const recFiles = files.filter((f) => f.RecordId === rec.Id);

            return (
              <div
                key={rec.Id}
                className="glass-panel p-7 rounded-[2rem] flex flex-col relative overflow-hidden group"
              >
                {/* Top Accent line */}
                <div
                  className="absolute top-0 right-0 w-full h-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, #3b82f6, #6366f1)",
                  }}
                ></div>

                <div className="flex flex-col gap-4 mb-6 relative z-10" onClick={(e) => {
                  if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") {
                    toggleCard(rec.Id);
                  }
                }}>
                  <div className="flex justify-end gap-2 items-center w-full">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCard(rec.Id); }}
                      className="flex items-center justify-center w-10 h-10 bg-blue-600/10 hover:bg-blue-600/30 text-blue-400 hover:text-white rounded-xl transition-all border border-blue-500/20 shadow-sm"
                      title={expandedCards.has(rec.Id) ? "طي" : "عرض التفاصيل"}
                    >
                      <ChevronDown size={20} className={`transition-transform duration-300 ${expandedCards.has(rec.Id) ? "rotate-180" : ""}`} />
                    </button>
                    <SingleRecordExport
                      record={rec}
                      parsedData={data}
                      subDepartmentName={subDepartment?.Name || ""}
                      user={user}
                      allUsers={allSystemUsers}
                    />
                    {(user.Role === "admin" ||
                      user.Role === "assistant" ||
                      user.Role === "department_manager" ||
                      user.Role === "supervisor" ||
                      (user.Role === "employee" &&
                        rec.CreatedBy_UserId === user.Id) ||
                      isCallManager) && (
                      <div className="flex gap-2 no-print" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            let parsed = rec.ParsedContent || {};
                            setFormData(parsed);
                            setIsEditing(rec.Id);
                            setIsAdding(true);
                            document
                              .querySelector(".overflow-auto")
                              ?.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          title="تعديل"
                          className="flex items-center justify-center w-10 h-10 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-blue-400 rounded-xl transition-all border border-slate-700 hover:border-blue-500/50 shadow-sm"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(rec.Id); }}
                          title="حذف"
                          className="flex items-center justify-center w-10 h-10 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700 hover:border-red-500/50 shadow-sm"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-slate-700 bg-slate-900/50 checked:bg-blue-500 cursor-pointer no-print"
                      checked={selectedIds.includes(rec.Id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => handleSelectRecord(rec.Id)}
                    />
                    {isFollowUp ? (
                      <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center font-bold text-lg border border-indigo-500/30">
                        {index + 1}
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center font-bold text-lg border border-blue-500/30">
                        {index + 1}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      {data.status && (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border border-white/10 w-max flex items-center gap-2 ${
                          data.status === "موعد مكتمل" || data.status === "تم الاتصال" ? "bg-emerald-500/10 text-emerald-400" :
                          data.status === "لم يحضر" || data.status === "غير متوفر" ? "bg-red-500/10 text-red-400" :
                          data.status === "إعادة اتصال" ? "bg-amber-500/10 text-amber-400" :
                          "bg-blue-500/10 text-blue-400"
                        }`}>
                          <span className={`w-2 h-2 rounded-full animate-pulse ${
                            data.status === "موعد مكتمل" || data.status === "تم الاتصال" ? "bg-emerald-500" :
                            data.status === "لم يحضر" || data.status === "غير متوفر" ? "bg-red-500" :
                            data.status === "إعادة اتصال" ? "bg-amber-500" :
                            "bg-blue-500"
                          }`}></span>
                          {data.status}
                        </span>
                      )}
                      <h3 className="font-extrabold text-2xl text-white leading-tight pr-3 border-r-4 border-blue-500">
                        {data.city
                          ? `${data.city} - ${data.area}`
                          : data.title ||
                            data.name ||
                            data.customerName ||
                            data.agentName ||
                            data.sellerName ||
                            "بدون اسم"}
                      </h3>
                   </div>
                 </div>
               </div>
                  <AnimatePresence>
                    {expandedCards.has(rec.Id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex flex-col flex-1"
                      >
                        {isRealEstate &&
                      data.realEstateStatus &&
                      data.realEstateStatus !== "تم البيع" && (
                        <div className="mb-4 mt-2 no-print z-20 flex gap-2">
                          {(user.Role === "admin" ||
                            user.Role === "supervisor" ||
                          ((user.Role === "employee" ||
                              isCallManager) &&
                              rec.CreatedBy_UserId === user.Id)) && (
                            <button
                              onClick={async () => {
                                setConfirmConfig({
                                  title: "تأكيد تحويل الحالة",
                                  message:
                                    "هل أنت متأكد من تحويل حالة هذا العقار إلى (مباع / مستكمل)؟",
                                  confirmText: "تأكيد التحويل",
                                  onConfirm: async () => {
                                    setConfirmConfig(null);
                                    const updatedData = {
                                      ...data,
                                      realEstateStatus: "تم البيع",
                                    };
                                    const ipcRenderer =
                                      window.require("electron").ipcRenderer;
                                    await ipcRenderer.invoke("update-record", {
                                      table: "Records",
                                      id: rec.Id,
                                      userId: user.Id,
                                      data: {
                                        Content: JSON.stringify(updatedData),
                                      },
                                    });
                                    const recs = await fetchTable(
                                      "Records",
                                      true,
                                    );
                                    setRecords(
                                      recs.filter(
                                        (r) =>
                                          r.SubDepartmentId ===
                                          subDepartment.Id,
                                      ),
                                    );
                                    import("react-hot-toast").then((m) =>
                                      m.default.success(
                                        "تم تحويل العقار إلى مباع بنجاح",
                                      ),
                                    );
                                  },
                                  onCancel: () => setConfirmConfig(null),
                                });
                              }}
                              className={`px-4 py-2 text-sm font-black rounded-xl shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg flex items-center gap-2 border bg-slate-800 hover:bg-blue-600 text-blue-400 hover:text-white border-blue-500/30`}
                            >
                              <CheckCircle2
                                size={16}
                                className="inline-block"
                              />{" "}
                              {data.realEstateStatus === "مطلوب"
                                ? "إنهاء الطلب (مستكمل)"
                                : "بيع العقار (تحويل لمباع)"}
                            </button>
                          )}
                        </div>
                      )}

                    {isRequestedComms &&
                      data.status !== "تم الاتصال" &&
                      data.status !== "إعادة اتصال" &&
                      data.status !== "لا يرد" && (
                        <div className="mb-4 no-print z-20 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmConfig({
                                title: "إجراء الاتصال وتسجيل النتيجة",
                                message:
                                  "سيتم نقلك لإنشاء سجل مكالمة لهذا العميل وسيتم تحديث حالة الطلب تلقائياً بناءً على ما تختاره. هل تريد الاستمرار؟",
                                confirmText: "نعم، الاستمرار للاتصال",
                                onConfirm: async () => {
                                  setConfirmConfig(null);
                                  if (onTransferCall)
                                    onTransferCall({
                                      name: data.customerName || "",
                                      phone: data.phone || "",
                                      details: data.notes || "",
                                      requestId: rec.Id,
                                    });
                                },
                                onCancel: () => setConfirmConfig(null),
                              });
                            }}
                            className="px-4 py-2 text-sm font-black rounded-xl shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg flex items-center gap-2 border bg-blue-600 hover:bg-blue-500 text-white border-blue-400"
                          >
                            <Plus size={16} className="inline-block" /> إجراء
                            الاتصال
                          </button>
                        </div>
                      )}


                    {(isRequestedComms || isComms) && data.status === "إعادة اتصال" && (
                      <div className="mb-4 no-print z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmConfig({
                              title: "إجراء الاتصال وتسجيل النتيجة",
                              message:
                                "سيتم نقلك لإنشاء سجل مكالمة لهذا العميل وسيتم تحديث حالة الطلب تلقائياً بناءً على ما تختاره. هل تريد الاستمرار؟",
                              confirmText: "نعم، الاستمرار للاتصال",
                              onConfirm: async () => {
                                setConfirmConfig(null);
                                if (onTransferCall)
                                  onTransferCall({
                                    name: data.customerName || data.name || data.title || "",
                                    phone: data.phone || "",
                                    details: data.notes || data.details || "",
                                    requestId: rec.Id,
                                  });
                              },
                              onCancel: () => setConfirmConfig(null),
                            });
                          }}
                          className="px-4 py-2 text-sm font-black rounded-xl shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg flex items-center gap-2 border bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/50 text-amber-400 cursor-pointer"
                        >
                          <RefreshCcw size={16} className="inline-block" />{" "}
                          إعادة اتصال
                        </button>
                      </div>
                    )}

                    {isComms && !isRequestedComms && (user.Role === 'admin' || user.Role === 'manager' || user.Role === 'department_manager' || user.Role === 'supervisor' || isCallManager) && (
                      <div className="mb-4 no-print z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmConfig({
                              title: "تأكيد النقل المتقدم",
                              message: "هل أنت متأكد من رغبتك بنسخ كافة بيانات هذا الاتصال والانتقال إلى قسم الاتصالات المطلوبة للتعديل عليها وحفظها كسجل جديد؟",
                              confirmText: "نعم، الاستمرار",
                              onConfirm: async () => {
                                setConfirmConfig(null);
                                if (onTransferToRequested) {
                                  onTransferToRequested({
                                    customerName: data.name || data.customerName || "",
                                    phone: data.phone || "",
                                    notes: data.details || data.notes || "",
                                    status: "إعادة اتصال",
                                    deleteOriginalId: rec.Id,
                                  });
                                }
                              },
                              onCancel: () => setConfirmConfig(null),
                            });
                          }}
                          className="px-4 py-2 text-sm font-black rounded-xl shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg flex items-center gap-2 border bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white border-purple-500/30"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3v18"/><path d="m10 14 7 7 7-7"/><path d="M7 21V3"/><path d="m3 10 4-7 4 7"/></svg>
                          نقل هذا الاتصال إلى الاتصالات المطلوبة
                        </button>
                      </div>
                    )}


                    <div className="space-y-4 mb-6 relative z-10 flex-1">
                      {Object.entries(data).map(([key, val]) => {
                        if (
                          !val ||
                          key === "city" ||
                          key === "area" ||
                          key === "title" ||
                          key === "name" ||
                          key === "customerName" ||
                          key === "status"
                        )
                          return null;

                        const labels = {
                          sellerName: "اسم البائع / المالك",
                          realEstateStatus: "الحالة",
                          location: "الموقع الدقيق",
                          type: "النوع",
                          price: "السعر النهائي",
                          phone: "رقم الهاتف",
                          details: "تفاصيل وملاحظات",
                          datetime: subDepartment?.Name?.includes("اتصال") ? "موعد الاتصال القادم" : "التاريخ",
                          contactDate: "تاريخ الاتصال",
                          extra: "إضافي",
                          agentName: "اسم الوكيل",
                          officeName: "اسم المكتب",
                          officeLocation: "الموقع",
                          responsibleArea: "المنطقة المسؤولة",
                          result: "النتيجة",
                          callDate: "تاريخ الاتصال",
                          reminder: "تذكير قبل (دقيقة)",
                          contractNumber: "رقم العقد",
                          count: "العدد",
                          notes: "تفاصيل وملاحظات الطلب",
                          status: "حالة الطلب",
                          assignedToUserId: "مخصص للموظف",
                          followUpType: "نوع المتابعة",
                          followUpDate: "تاريخ المتابعة",
                          callRecordId: "الاتصال السابق",
                        };
                        const label = labels[key] || key;
                        
                        if (key === "callRecordId") {
                          const call = availableCalls?.find(c => c.Id.toString() === val?.toString());
                          const callData = call?.ParsedContent || {};
                          const callText = callData.name || callData.title || callData.agentName ? `${callData.name || callData.title || callData.agentName} - ${callData.phone || ""}` : val;
                          return (
                            <div
                              key={key}
                              className="flex flex-col bg-white/5 p-4 rounded-2xl border border-white/5"
                            >
                              <span className="text-[11px] font-bold text-indigo-400/80 mb-1 tracking-wider uppercase">
                                {label}
                              </span>
                              <span className="text-sm font-bold text-slate-200">
                                {callText}
                              </span>
                            </div>
                          );
                        }

                        if (key === "locationUrl") {
                          return (
                            <div
                              key={key}
                              className="flex flex-col bg-white/5 p-4 rounded-2xl border border-white/5"
                            >
                              <span className="text-[11px] font-bold text-indigo-400/80 mb-1 tracking-wider uppercase">
                                رابط الموقع (Location)
                              </span>
                              <a
                                href={
                                  val.startsWith("http")
                                    ? val
                                    : `https://${val}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-blue-400 hover:text-blue-300 underline underline-offset-4 w-fit"
                              >
                                فتح الموقع في الخريطة
                              </a>
                            </div>
                          );
                        }

                        if (key === "datetime") {
                          let dateStr = val;
                          try {
                            const d = new Date(val);
                            if (!isNaN(d)) {
                              dateStr = d.toLocaleString("en-US", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              });
                            }
                          } catch (e) {}

                          return (
                            <div
                              key={key}
                              className="flex flex-col bg-white/5 p-4 rounded-2xl border border-white/5"
                            >
                              <span className="text-[11px] font-bold text-indigo-400/80 mb-1 tracking-wider uppercase">
                                {label}
                              </span>
                              <span
                                className="text-sm text-slate-200 font-medium dir-ltr text-left block font-mono"
                                dir="ltr"
                              >
                                {dateStr}
                              </span>
                            </div>
                          );
                        }

                        if (key === "contactDate" || key === "callDate") {
                          const dDate = new Date(val);
                          const today = new Date();
                          dDate.setHours(0, 0, 0, 0);
                          today.setHours(0, 0, 0, 0);
                          const diffTime = today.getTime() - dDate.getTime();
                          const diffDays = Math.round(
                            diffTime / (1000 * 60 * 60 * 24),
                          );

                          let text = "";
                          if (diffDays === 0) text = "اليوم";
                          else if (diffDays === 1) text = "أمس";
                          else if (diffDays === 2) text = "منذ يومين";
                          else if (diffDays > 2) text = `قبل ${diffDays} أيام`;
                          else if (diffDays < 0)
                            text = `بعد ${Math.abs(diffDays)} أيام`;

                          return (
                            <div
                              key={key}
                              className="flex flex-col bg-white/5 p-4 rounded-2xl border border-white/5"
                            >
                              <span className="text-[11px] font-bold text-indigo-400/80 mb-1 tracking-wider uppercase">
                                {labels[key] || "التاريخ"}
                              </span>
                              <span className="text-sm text-slate-200 font-medium">
                                {val}{" "}
                                <span className="text-xs text-amber-500/80 font-bold mr-3">
                                  ({text})
                                </span>
                              </span>
                            </div>
                          );
                        }

                        let displayVal = val;
                        if (key === "assignedToUserId") {
                          const assignedUser = Array.isArray(allSystemUsers) && allSystemUsers.find(u => String(u.Id) === String(val));
                          displayVal = assignedUser ? (assignedUser.FullName || assignedUser.Username) : "مجهول";
                        }

                        if (key === "phone") {
                          const cleanNum = String(val).replace(/\D/g, "");
                          const waNum = cleanNum.startsWith("0") ? "964" + cleanNum.substring(1) : cleanNum;

                          return (
                            <div
                              key={key}
                              className="flex flex-col bg-white/5 p-4 rounded-2xl border border-white/5"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-indigo-400/80 tracking-wider uppercase">
                                  {label}
                                </span>
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <a
                                    href={`tel:${cleanNum}`}
                                    className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[11px] font-black border border-emerald-500/30 flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                                    title="اتصال مباشر"
                                  >
                                    📞 اتصال
                                  </a>
                                  <a
                                    href={`https://wa.me/${waNum}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-0.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[11px] font-black border border-green-500/30 flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                                    title="مراسلة واتساب"
                                  >
                                    💬 واتساب
                                  </a>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-blue-300 font-mono tracking-wider dir-ltr text-right">
                                {displayVal}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={key}
                            className={`flex flex-col bg-white/5 p-4 rounded-2xl border border-white/5 ${key === "realEstateStatus" ? (val === "تم البيع" ? "border-emerald-500/50 bg-emerald-500/10" : "border-indigo-500/50 bg-indigo-500/10") : ""}`}
                          >
                            <span className="text-[11px] font-bold text-indigo-400/80 mb-1 tracking-wider uppercase">
                              {label}
                            </span>
                            <span
                              className={`text-sm text-slate-200 font-medium ${key === "price" ? "font-extrabold text-green-400 text-xl" : ""} ${key === "phone" ? "dir-ltr text-right block tracking-wider font-mono text-blue-300" : ""} ${key === "realEstateStatus" ? "font-black text-white" : ""}`}
                            >
                              {key === "price"
                                ? Number(val).toLocaleString("en-US") + " د.ع"
                                : displayVal}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Attachments Display */}
                    {recFiles.length > 0 && (
                      <div className="mb-4 pt-5 border-t border-white/10">
                        <p className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
                          <Paperclip size={14} /> المرفقات المحفوظة (
                          {recFiles.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {recFiles.map((f) => (
                            <button
                              key={f.Id}
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  const { ipcRenderer } =
                                    window.require("electron");
                                  const { default: toast } =
                                    await import("react-hot-toast");
                                  const res = await ipcRenderer.invoke(
                                    "open-file",
                                    f.Id,
                                    f.FilePath,
                                  );
                                  if (!res.success)
                                    toast.error(
                                      "لا يمكن فتح الملف: " +
                                        (res.error || "غير متوفر"),
                                    );
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-blue-300 hover:text-blue-200 transition-all shadow-sm cursor-pointer"
                            >
                              <File size={14} />
                              <span className="truncate max-w-[120px]">
                                {f.FilePath.split("\\")
                                  .pop()
                                  .split("_")
                                  .slice(1)
                                  .join("_")}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex justify-between items-center pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400">
                          {(() => {
                            const creatorObj =
                              allSystemUsers.find(
                                (u) => u.Id === rec.CreatedBy_UserId,
                              ) || user;
                            const name =
                              creatorObj.FullName || creatorObj.Username || "?";
                            return name.charAt(0).toUpperCase();
                          })()}
                        </div>
                        <span className="text-xs font-bold text-slate-400">
                          {(() => {
                            const creatorObj =
                              allSystemUsers.find(
                                (u) => u.Id === rec.CreatedBy_UserId,
                              ) || user;
                            return creatorObj.FullName || creatorObj.Username;
                          })()}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-900/50 px-2 py-1 rounded-md border border-white/5">
                        {formatBaghdadTime(rec.CreatedAt, false)}
                      </span>
                    </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {visibleCount < filteredRecords.length && (
        <div className="flex justify-center mt-10 w-full col-span-full gap-4">
          <button
            onClick={() => setVisibleCount((v) => v + 50)}
            className="px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-bold shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            عرض المزيد ({filteredRecords.length - visibleCount} متبقي)
          </button>
          <button
            onClick={() => setVisibleCount(filteredRecords.length)}
            className="px-8 py-3 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/40 text-blue-400 hover:text-white rounded-xl font-bold shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            عرض الكل ({filteredRecords.length})
          </button>
        </div>
      )}

      {/* ─── View All Follow-ups Modal ────────────────────────────────────── */}
      <ViewAllFollowUpsModal
        modal={viewAllModal}
        onClose={() => setViewAllModal(null)}
        onEdit={(data, recId) => {
          setViewAllModal(null);
          setFormData(data);
          setIsEditing(recId);
          setIsAdding(true);
          document.querySelector(".overflow-auto")?.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onDelete={handleDelete}
        user={user}
        isCallManager={isCallManager}
        allSystemUsers={allSystemUsers}
        subDepartment={subDepartment}
      />

      {/* ─── Bulk WhatsApp Modal ──────────────────────────────────────────── */}
      <BulkWhatsAppModal
        show={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        selectedCount={selectedIds.length}
        bulkMessage={bulkMessage}
        setBulkMessage={setBulkMessage}
        bulkProgress={bulkProgress}
        waDelay={waDelay}
        setWaDelay={setWaDelay}
        customWaDelay={customWaDelay}
        setCustomWaDelay={setCustomWaDelay}
        onStart={startBulkWhatsApp}
        isDragging={isDraggingBulk}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingBulk(true); }}
        onDragLeave={() => setIsDraggingBulk(false)}
        onDrop={handleBulkDrop}
        bulkFiles={bulkFiles}
        onRemoveBulkFile={handleRemoveBulkFile}
      />

      <ConfirmModal {...(confirmConfig || {})} isOpen={!!confirmConfig} />
    </div>
  );
};

export default DataTableView;
