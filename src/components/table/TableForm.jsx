import React from "react";
import {
  FileText,
  UploadCloud,
  Paperclip,
  CheckCircle2,
  Save,
} from "lucide-react";
import AttachmentsModal from "../ui/AttachmentsModal";

const toEng = (s) => s ? s.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)) : "";

const TableForm = ({
  isAdding,
  handleSubmit,
  isRealEstate,
  isRequestedComms,
  isFollowUp,
  isComms,
  isAppt,
  isBrokers,
  isCustomers,
  formData,
  setFormData,
  allContacts,
  availableCalls,
  allSystemUsers,
  subDepartment,
  customCategories,
  uploading,
  attachedFiles,
  handleFileSelect,
  onRemoveFile,
  isSubmittingData,
  existingFiles = [],
  onRemoveExistingFile = null,
  onAttachmentsModalClose = null,
}) => {
  const [isDraggingLocal, setIsDraggingLocal] = React.useState(false);

  React.useEffect(() => {
    if (!isAdding) return;
    const handleGlobalPaste = (e) => {
      if (
        e.clipboardData &&
        e.clipboardData.files &&
        e.clipboardData.files.length > 0
      ) {
        // If focus is inside an input (like text fields), we don't want to hijack text pasting, but if it's an image file, the text input won't accept it anyway, so we can intercept it!
        const file = e.clipboardData.files[0];
        if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
          handleFileSelect(e);
        }
      }
    };
    document.addEventListener("paste", handleGlobalPaste);
    return () => {
      document.removeEventListener("paste", handleGlobalPaste);
    };
  }, [isAdding, handleFileSelect]);

  if (!isAdding) return null;

  return (
    <form
      onSubmit={handleSubmit}
      className="no-print animate-slide-up space-y-6"
      style={{
        background: "#18181b", // Zinc 900
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "24px",
        padding: "32px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px -10px rgba(0, 0, 0, 0.5)",
      }}
    >
      <h3
        className="text-xl font-bold text-white flex items-center gap-3 pb-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="w-10 h-10 flex items-center justify-center rounded-xl"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            boxShadow:
              "0 4px 10px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        >
          <FileText size={18} style={{ color: "#fff" }} />
        </div>
        {isRealEstate
          ? "بيانات العقار"
          : isRequestedComms
            ? "طلب اتصال جديد"
            : isFollowUp
              ? "تفاصيل المتابعة"
              : isComms
                ? "بيانات الاتصال"
                : isAppt
                  ? "بيانات الموعد"
                  : isBrokers
                    ? "بيانات الوكيل"
                    : isCustomers
                      ? "بيانات العميل"
                      : "نموذج إدخال مخصص"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {isRealEstate ? (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                اسم المالك / البائع
              </label>
              <input
                type="text"
                value={formData.sellerName || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, sellerName: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                حالة العقار
              </label>
              <select
                value={formData.realEstateStatus || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, realEstateStatus: e.target.value })
                }
                className="premium-input bg-slate-900"
              >
                <option value="">-- اختر الحالة --</option>
                <option value="للعرض">للعرض (للبيع/للايجار)</option>
                <option value="مطلوب">مطلوب (شراء/استئجار)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                رقم الهاتف
              </label>
              <input
                type="text"
                dir="ltr"
                value={formData.phone || ""}
                maxLength={11}
                required
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: toEng(e.target.value).replace(/\D/g, ""),
                  })
                }
                className={`premium-input ${formData.phone && formData.phone.length !== 11 ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : ""}`}
                placeholder="07XXXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                المدينة الأساسية
              </label>
              <input
                type="text"
                value={formData.city || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                المنطقة الجغرافية / الحي
              </label>
              <input
                type="text"
                value={formData.area || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, area: e.target.value })
                }
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                نوع العقار
              </label>
              <select
                value={
                  formData.type &&
                  !["منزل", "قطعة ارض", "شقة", "فيلا", "مزرعة"].includes(
                    formData.type,
                  ) &&
                  formData.type !== ""
                    ? "متخصص"
                    : formData.type || ""
                }
                required
                onChange={(e) => {
                  if (e.target.value !== "متخصص") {
                    setFormData({
                      ...formData,
                      type: e.target.value,
                      customType: "",
                    });
                  } else {
                    setFormData({ ...formData, type: "متخصص" });
                  }
                }}
                className="premium-input bg-slate-900"
              >
                <option value="">-- اختر النوع --</option>
                <option value="منزل">منزل</option>
                <option value="قطعة ارض">قطعة ارض</option>
                <option value="شقة">شقة</option>
                <option value="فيلا">فيلا</option>
                <option value="مزرعة">مزرعة</option>
                <option value="متخصص">متخصص (أخرى)</option>
              </select>
            </div>
            {formData.type &&
              !["منزل", "قطعة ارض", "شقة", "فيلا", "مزرعة"].includes(
                formData.type,
              ) && (
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                    اكتب النوع المخصص
                  </label>
                  <input
                    type="text"
                    value={
                      formData.customType ||
                      (formData.type === "متخصص" ? "" : formData.type)
                    }
                    required
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customType: e.target.value,
                        type: e.target.value,
                      })
                    }
                    className="premium-input border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                    placeholder="اكتب نوع العقار..."
                  />
                </div>
              )}

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                السعر / التكلفة (د.ع)
              </label>
              <input
                type="text"
                value={
                  formData.price
                    ? isNaN(Number(formData.price))
                      ? formData.price
                      : Number(formData.price).toLocaleString("en-US")
                    : ""
                }
                required
                onChange={(e) => {
                  const raw = toEng(e.target.value).replace(/,/g, "");
                  if (!isNaN(raw) || raw === "")
                    setFormData({ ...formData, price: raw });
                }}
                className="premium-input font-bold text-green-400"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                التوجيه (موقع تفصيلي)
              </label>
              <input
                type="text"
                value={formData.location || ""}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                Location (رابط الموقع على الخريطة)
              </label>
              <input
                type="url"
                value={formData.locationUrl || ""}
                onChange={(e) =>
                  setFormData({ ...formData, locationUrl: e.target.value })
                }
                className="premium-input"
                placeholder="https://maps.google.com/..."
                dir="ltr"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                المواصفات والملاحظات
              </label>
              <textarea
                value={formData.details || ""}
                onChange={(e) =>
                  setFormData({ ...formData, details: e.target.value })
                }
                className="premium-input"
                rows="3"
              ></textarea>
            </div>
          </>
        ) : isFollowUp ? (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                اختر الاتصال السابق
              </label>
              <input
                list="calls-list"
                type="text"
                required
                value={
                  formData.callRecordId_search !== undefined 
                    ? formData.callRecordId_search 
                    : (() => {
                        const call = availableCalls?.find(c => c.Id.toString() === formData.callRecordId?.toString());
                        if (call) {
                           const d = call.ParsedContent || {};
                           return `${d.name || d.title || d.agentName || "بدون اسم"} - ${d.phone || ""}`;
                        }
                        return "";
                      })()
                }
                onChange={(e) => {
                  const val = e.target.value;
                  const foundCall = availableCalls?.find(c => {
                    const d = c.ParsedContent || {};
                    const label = `${d.name || d.title || d.agentName || "بدون اسم"} - ${d.phone || ""}`;
                    return label === val;
                  });
                  if (foundCall) {
                    setFormData({ ...formData, callRecordId_search: val, callRecordId: foundCall.Id.toString() });
                  } else {
                    setFormData({ ...formData, callRecordId_search: val, callRecordId: "" });
                  }
                }}
                className="premium-input bg-slate-900"
                placeholder="ابحث واكتب اسم أو رقم الاتصال السابق..."
              />
              <datalist id="calls-list">
                {availableCalls?.map((c) => {
                  const d = c.ParsedContent || {};
                  return (
                    <option key={c.Id} value={`${d.name || d.title || d.agentName || "بدون اسم"} - ${d.phone || ""}`} />
                  );
                })}
              </datalist>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                نوع المتابعة
              </label>
              <select
                value={formData.followUpType || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, followUpType: e.target.value })
                }
                className="premium-input bg-slate-900"
              >
                <option value="">-- اختر النوع --</option>
                <option value="متابعة 1">متابعة 1</option>
                <option value="متابعة 2">متابعة 2</option>
                <option value="متابعة 3">متابعة 3</option>
                <option value="متابعة 4">متابعة 4</option>
                <option value="اخرى">اخرى</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                تاريخ المتابعة
              </label>
              <input
                type="date"
                value={formData.followUpDate || new Date().toISOString().split("T")[0]}
                required
                onChange={(e) =>
                  setFormData({ ...formData, followUpDate: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                تفاصيل المتابعة
              </label>
              <textarea
                value={formData.details || ""}
                onChange={(e) =>
                  setFormData({ ...formData, details: e.target.value })
                }
                className="premium-input"
                rows="4"
                placeholder="اكتب تفاصيل المتابعة هنا..."
                required
              ></textarea>
            </div>
          </>
        ) : isRequestedComms ? (
          <>
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                اسم العميل (إن وجد)
              </label>
              <input
                type="text"
                value={formData.customerName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, customerName: e.target.value })
                }
                className="premium-input"
                placeholder="اكتب اسم العميل..."
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                رقم الهاتف
              </label>
              <input
                type="text"
                dir="ltr"
                value={formData.phone || ""}
                maxLength={11}
                required
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: toEng(e.target.value).replace(/\D/g, ""),
                  })
                }
                className={`premium-input ${formData.phone && formData.phone.length !== 11 ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : ""}`}
                placeholder="07XXXXXXXXX"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-emerald-400 mb-2 ml-1">
                تخصيص الطلب لموظف
              </label>
              <select
                value={formData.assignedToUserId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, assignedToUserId: e.target.value })
                }
                className="premium-input bg-emerald-900/10 border-emerald-500/20 text-emerald-100"
              >
                <option value="">-- للجميع --</option>
                {Array.isArray(allSystemUsers) && allSystemUsers
                  .filter((u) => {
                    if (u.Role === "admin" || u.Role === "assistant") return false;
                    if (!subDepartment) return true;
                    if (u.AllowedSubDepartments === '"all"' || u.AllowedSubDepartments === "all" || u.AllowedSubDepartments === '["all"]') return true;
                    try {
                      const parsed = JSON.parse(u.AllowedSubDepartments || "[]");
                      return parsed.includes(String(subDepartment.Id));
                    } catch(e) {
                      return false;
                    }
                  })
                  .map((u) => (
                    <option key={u.Id} value={u.Id}>
                      {u.FullName || u.Username}
                    </option>
                  ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                تفاصيل وملاحظات الطلب
              </label>
              <textarea
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="premium-input"
                rows="3"
                placeholder="اكتب الملاحظات والتفاصيل المطلوبة من هذا الاتصال..."
              ></textarea>
            </div>
          </>
        ) : isComms ? (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                الاسم / الجهة المتصلة
              </label>
              <input
                type="text"
                value={formData.name || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                رقم الهاتف
              </label>
              <input
                type="text"
                dir="ltr"
                value={formData.phone || ""}
                maxLength={11}
                required
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: toEng(e.target.value).replace(/\D/g, ""),
                  })
                }
                className={`premium-input ${formData.phone && formData.phone.length !== 11 ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                تاريخ الاتصال
              </label>
              <input
                type="date"
                lang="en-US"
                value={
                  formData.contactDate || new Date().toISOString().split("T")[0]
                }
                required
                onChange={(e) =>
                  setFormData({ ...formData, contactDate: e.target.value })
                }
                className="premium-input text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                النتيجة
              </label>
              <select
                value={formData.result || ""}
                required={
                  formData.status !== "إعادة اتصال" &&
                  formData.status !== "لا يرد"
                }
                onChange={(e) =>
                  setFormData({ ...formData, result: e.target.value })
                }
                className="premium-input bg-slate-900"
              >
                <option value="">-- اختر النتيجة --</option>
                <option value="ممتازة">ممتازة</option>
                <option value="جيدة">جيدة</option>
                <option value="متوسطة">متوسطة</option>
                <option value="غير جيدة">غير جيدة</option>
                <option value="سيئة">سيئة</option>
                {customCategories && customCategories.map((c) => (
                  <option key={c.Id} value={c.Name}>
                    {c.Name}
                  </option>
                ))}
                <option value="مخصص">مخصص (إدخال يدوي)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                حالة الاتصال
              </label>
              <select
                value={formData.status || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="premium-input"
              >
                <option value="">-- اختر حالة الاتصال --</option>
                <option value="تم الاتصال">تم الاتصال</option>
                <option value="إعادة اتصال">إعادة اتصال</option>
                <option value="لا يرد">لا يرد</option>
              </select>
            </div>

            {formData.status === "تم الاتصال" && (
              <div className="md:col-span-2 mt-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-slate-900/30 cursor-pointer hover:bg-slate-900/50 transition-colors w-max">
                  <input
                    type="checkbox"
                    checked={formData.scheduleAnotherCall || false}
                    onChange={(e) => setFormData({ ...formData, scheduleAnotherCall: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="font-bold text-slate-300">هل تريد الاتصال به في وقت لاحق مرة أخرى؟</span>
                </label>
              </div>
            )}

            {(formData.status === "إعادة اتصال" || (formData.status === "تم الاتصال" && formData.scheduleAnotherCall)) && (
              <div className="md:col-span-2 mt-4 bg-slate-900/50 p-6 rounded-[2rem] border border-amber-500/20 shadow-[0_10px_30px_rgba(245,158,11,0.05)] relative">
                <div className="absolute -top-3 right-6 bg-slate-950 px-3 text-sm font-bold text-amber-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  جدولة الاتصال القادم والتنبيهات
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <div>
                    <label className="block text-sm font-bold text-amber-400/80 mb-2 ml-1">
                      تاريخ ووقت الاتصال القادم
                    </label>
                    <input
                      type="datetime-local"
                      lang="en-US"
                      max="2099-12-31T23:59"
                      value={formData.datetime || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, datetime: e.target.value })
                      }
                      className="premium-input text-left border-amber-500/30 focus:border-amber-500 bg-slate-950"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-amber-400/80 mb-2 ml-1">
                      تذكير وتنبيه قبل الاتصال بـ
                    </label>
                    <select
                      value={formData.reminder || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, reminder: e.target.value })
                      }
                      className="premium-input border-amber-500/30 focus:border-amber-500 bg-slate-950 mb-2"
                    >
                      <option value="">بدون تذكير</option>
                      <option value="15">15 دقيقة</option>
                      <option value="30">30 دقيقة</option>
                      <option value="60">ساعة واحدة</option>
                      <option value="1440">يوم واحد (24 ساعة)</option>
                      <option value="custom">مخصص (بالأيام)</option>
                    </select>
                    {formData.reminder === "custom" && (
                      <input
                        type="number"
                        min="1"
                        placeholder="عدد الأيام (مثال: 3)"
                        value={formData.customReminder || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, customReminder: e.target.value })
                        }
                        className="premium-input text-sm py-2 border-amber-500/30 focus:border-amber-500 bg-slate-950"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {formData.result === "مخصص" && (
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                  نتيجة مخصصة
                </label>
                <input
                  type="text"
                  required
                  value={formData.customResult || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, customResult: e.target.value })
                  }
                  className="premium-input"
                  placeholder="اكتب النتيجة..."
                />
              </div>
            )}

            <div className="lg:col-span-3">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                الغاية / التفاصيل / ملاحظات
              </label>
              <textarea
                value={formData.details || ""}
                required={
                  formData.status !== "إعادة اتصال" &&
                  formData.status !== "قيد الانتظار" &&
                  formData.status !== "غير متوفر"
                }
                onChange={(e) =>
                  setFormData({ ...formData, details: e.target.value })
                }
                className="premium-input"
                rows="3"
              ></textarea>
            </div>
          </>
        ) : isAppt ? (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                اسم العميل
              </label>
              <input
                list="contacts-list"
                type="text"
                value={formData.title || ""}
                required
                onChange={(e) => {
                  const val = e.target.value;
                  const contact = allContacts.find((c) => c.name === val);
                  if (contact) {
                    setFormData({
                      ...formData,
                      title: val,
                      phone: contact.phone,
                    });
                  } else {
                    setFormData({ ...formData, title: val });
                  }
                }}
                className="premium-input"
                placeholder="اكتب للبحث أو إضافة عميل..."
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                رقم الهاتف
              </label>
              <input
                list="contacts-list-phone"
                type="text"
                dir="ltr"
                value={formData.phone || ""}
                maxLength={11}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: toEng(e.target.value).replace(/\D/g, ""),
                  })
                }
                className={`premium-input ${formData.phone && formData.phone.length !== 11 ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : ""}`}
                placeholder="07XXXXXXXXX"
              />
              <datalist id="contacts-list">
                {allContacts.map((c, idx) => (
                  <option key={idx} value={c.name}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </datalist>
              <datalist id="contacts-list-phone">
                {allContacts.map((c, idx) => (
                  <option key={`p${idx}`} value={c.phone}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                التاريخ والوقت
              </label>
              <input
                type="datetime-local"
                lang="en-US"
                max="2099-12-31T23:59"
                value={formData.datetime || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, datetime: e.target.value })
                }
                className="premium-input text-left"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                حالة الموعد
              </label>
              <select
                value={formData.status || "قيد الانتظار"}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="premium-input bg-slate-900 mb-2"
              >
                <option value="قيد الانتظار">قيد الانتظار</option>
                <option value="موعد مكتمل">موعد مكتمل</option>
                <option value="لم يحضر">لم يحضر</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                تذكير وتنبيه قبل
              </label>
              <select
                value={formData.reminder || ""}
                onChange={(e) =>
                  setFormData({ ...formData, reminder: e.target.value })
                }
                className="premium-input bg-slate-900 mb-2"
              >
                <option value="">بدون تذكير</option>
                <option value="15">15 دقيقة</option>
                <option value="30">30 دقيقة</option>
                <option value="60">ساعة واحدة</option>
                <option value="1440">يوم واحد (24 ساعة)</option>
                <option value="custom">مخصص (بالأيام)</option>
              </select>
              {formData.reminder === "custom" && (
                <input
                  type="number"
                  min="1"
                  placeholder="عدد الأيام (مثال: 3)"
                  value={formData.customReminder || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, customReminder: e.target.value })
                  }
                  className="premium-input text-sm py-2"
                />
              )}
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                التفاصيل
              </label>
              <textarea
                value={formData.details || ""}
                onChange={(e) =>
                  setFormData({ ...formData, details: e.target.value })
                }
                className="premium-input"
                rows="3"
              ></textarea>
            </div>
          </>
        ) : isBrokers ? (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                اسم الوكيل
              </label>
              <input
                type="text"
                value={formData.agentName || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, agentName: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                اسم مكتبه (إن وجد)
              </label>
              <input
                type="text"
                value={formData.officeName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, officeName: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                رقم الهاتف
              </label>
              <input
                type="text"
                dir="ltr"
                value={formData.phone || ""}
                maxLength={11}
                required
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: toEng(e.target.value).replace(/\D/g, ""),
                  })
                }
                className={`premium-input ${formData.phone && formData.phone.length !== 11 ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                موقع المكتب
              </label>
              <input
                type="text"
                value={formData.officeLocation || ""}
                onChange={(e) =>
                  setFormData({ ...formData, officeLocation: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                مسؤول عن منطقة / حي
              </label>
              <input
                type="text"
                value={formData.responsibleArea || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, responsibleArea: e.target.value })
                }
                className="premium-input"
              />
            </div>
          </>
        ) : isCustomers ? (
          <>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                اسم العميل
              </label>
              <input
                type="text"
                value={formData.name || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                رقم الهاتف
              </label>
              <input
                type="text"
                dir="ltr"
                value={formData.phone || ""}
                maxLength={11}
                required
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: toEng(e.target.value).replace(/\D/g, ""),
                  })
                }
                className={`premium-input ${formData.phone && formData.phone.length !== 11 ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : ""}`}
                placeholder="07XXXXXXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                تاريخ الاتصال
              </label>
              <input
                type="date"
                lang="en-US"
                value={
                  formData.callDate || new Date().toISOString().split("T")[0]
                }
                required
                onChange={(e) =>
                  setFormData({ ...formData, callDate: e.target.value })
                }
                className="premium-input text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                التصنيف
              </label>
              <select
                value={formData.category || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="premium-input bg-slate-900"
              >
                <option value="">-- اختر التصنيف --</option>
                <option value="مستثمر سابق">مستثمر سابق</option>
                <option value="مستثمر حالي">مستثمر حالي</option>
                <option value="مالك وحدة سكنية">مالك وحدة سكنية</option>
                {customCategories.map((c) => (
                  <option key={c.Id} value={c.Name}>
                    {c.Name}
                  </option>
                ))}
                <option value="مخصص">مخصص (إدخال يدوي)</option>
              </select>
            </div>
            {formData.category === "مخصص" && (
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                  تصنيف مخصص
                </label>
                <input
                  type="text"
                  required
                  value={formData.customCategory || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, customCategory: e.target.value })
                  }
                  className="premium-input"
                  placeholder="اكتب التصنيف الجديد هنا وسيتم حفظه"
                />
              </div>
            )}

            <div className="lg:col-span-3">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                التفاصيل الكاملة
              </label>
              <textarea
                value={formData.details || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, details: e.target.value })
                }
                className="premium-input"
                rows="4"
              ></textarea>
            </div>
          </>
        ) : (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                العنوان / المرجع
              </label>
              <input
                type="text"
                value={formData.title || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                رقم الهاتف (اختياري)
              </label>
              <input
                type="text"
                dir="ltr"
                value={formData.phone || ""}
                maxLength={11}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: toEng(e.target.value).replace(/\D/g, ""),
                  })
                }
                className={`premium-input ${formData.phone && formData.phone.length !== 11 ? "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : ""}`}
                placeholder="07XXXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                معلومة إضافية
              </label>
              <input
                type="text"
                value={formData.extra || ""}
                onChange={(e) =>
                  setFormData({ ...formData, extra: e.target.value })
                }
                className="premium-input"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-bold text-slate-400 mb-2 ml-1">
                التفاصيل الكاملة
              </label>
              <textarea
                value={formData.details || ""}
                required
                onChange={(e) =>
                  setFormData({ ...formData, details: e.target.value })
                }
                className="premium-input"
                rows="4"
              ></textarea>
            </div>
          </>
        )}
      </div>

      {/* File Attachments */}
      <div className="pt-6 border-t border-white/5 relative z-10">
        <label className="block text-sm font-bold text-slate-300 mb-4 ml-1">
          المرفقات ({attachedFiles.length + existingFiles.length})
        </label>
        <button
          type="button"
          onClick={() => setIsDraggingLocal(true)}
          className="w-full flex flex-col items-center justify-center p-6 bg-slate-900/50 border-2 border-slate-700/50 border-dashed hover:border-purple-500/50 hover:bg-slate-800 rounded-2xl transition-all group"
        >
          <div
            className={`p-2.5 rounded-full border mb-3 transition-all ${uploading ? "bg-purple-500/20 border-purple-500/30 text-purple-400 animate-pulse" : "bg-white/5 border-white/10 text-slate-400 group-hover:bg-purple-500/20 group-hover:border-purple-500/30 group-hover:text-purple-400"}`}
          >
            <UploadCloud
              size={24}
              className={uploading ? "animate-bounce" : ""}
            />
          </div>
          <span className="font-bold text-slate-300">
            {uploading
              ? "جاري المعالجة والرفع..."
              : "إدارة المرفقات (انقر للفتح)"}
          </span>
          <span className="text-xs text-slate-500 mt-1">
            يمكنك السحب والإفلات أو النسخ واللصق (Ctrl+V)
          </span>
        </button>
      </div>

      <div className="flex justify-end pt-6 relative z-10">
        <button
          type="submit"
          disabled={uploading || isSubmittingData}
          className="glow-button px-8 py-3.5 premium-gradient text-white font-extrabold text-lg rounded-2xl flex items-center gap-3 shadow-[0_10px_30px_rgba(109,40,217,0.3)] disabled:opacity-50"
        >
          {uploading || isSubmittingData ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>{" "}
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save size={20} /> حفظ البيانات
            </>
          )}
        </button>
      </div>

      <AttachmentsModal
        isOpen={isDraggingLocal}
        onClose={() => {
          setIsDraggingLocal(false);
          if (onAttachmentsModalClose) onAttachmentsModalClose();
        }}
        attachedFiles={attachedFiles}
        onRemoveFile={onRemoveFile}
        onFilesDrop={handleFileSelect}
        uploading={uploading}
        existingFiles={existingFiles}
        onRemoveExistingFile={onRemoveExistingFile}
      />
    </form>
  );
};

export default TableForm;
