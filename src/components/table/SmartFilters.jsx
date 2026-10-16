/**
 * SmartFilters.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * All filter panels used in DataTableView:
 *   • Real Estate filters (city, area, type, price range)
 *   • Global time filter (3 days / 1 week / custom)
 *   • Customers category filter
 *   • Communications status filter
 *   • Communications result filter
 *
 * Props mirror the state slices in DataTableView. No business logic lives
 * here — only the controlled JSX for each filter panel.
 */

import React from "react";
import { Filter } from "lucide-react";

const SmartFilters = ({
  isRealEstate,
  isCustomers,
  isComms,
  isRequestedComms,
  isAdding,
  filters,
  setFilters,
  timeFilter,
  setTimeFilter,
  customTimeDays,
  setCustomTimeDays,
  customCategories,
}) => {
  return (
    <>
      {/* ─── Real Estate Filters ─────────────────────────────────────────── */}
      {isRealEstate && !isAdding && (
        <div className="glass-panel p-5 rounded-2xl flex flex-wrap items-center gap-4 no-print animate-slide-up mb-6">
          <div className="flex items-center gap-2 text-slate-300 font-bold ml-2">
            <Filter size={18} className="text-blue-400" /> الفلاتر:
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
            <select
              value={filters.realEstateStatus || ""}
              onChange={(e) => setFilters({ ...filters, realEstateStatus: e.target.value })}
              className="premium-input !py-2 !rounded-xl text-sm bg-slate-900 w-full"
            >
              <option value="">كل الحالات</option>
              <option value="للعرض">للعرض</option>
              <option value="مطلوب">مطلوب</option>
              <option value="تم البيع">المباع/المكتمل</option>
            </select>
            <input
              type="text"
              placeholder="المدينة"
              value={filters.city || ""}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              className="premium-input !py-2 !rounded-xl text-sm w-full"
            />
            <input
              type="text"
              placeholder="المنطقة"
              value={filters.area || ""}
              onChange={(e) => setFilters({ ...filters, area: e.target.value })}
              className="premium-input !py-2 !rounded-xl text-sm w-full"
            />
            <input
              type="text"
              placeholder="نوع العقار"
              value={filters.type || ""}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="premium-input !py-2 !rounded-xl text-sm w-full"
            />
            <input
              type="text"
              placeholder="أقل سعر"
              dir="ltr"
              value={filters.minPrice ? Number(filters.minPrice).toLocaleString("en-US") : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, "").replace(/\D/g, "");
                setFilters({ ...filters, minPrice: raw });
              }}
              className="premium-input !py-2 !rounded-xl text-sm w-full"
            />
            <input
              type="text"
              placeholder="أعلى سعر"
              dir="ltr"
              value={filters.maxPrice ? Number(filters.maxPrice).toLocaleString("en-US") : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, "").replace(/\D/g, "");
                setFilters({ ...filters, maxPrice: raw });
              }}
              className="premium-input !py-2 !rounded-xl text-sm w-full"
            />
          </div>
          <div className="w-full flex justify-end mt-2">
            <button
              onClick={() => setFilters({})}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm transition-all font-bold shadow-md hover:shadow-lg"
            >
              مسح الفلاتر
            </button>
          </div>
        </div>
      )}

      {/* ─── Global Time Filter ──────────────────────────────────────────── */}
      {!isAdding && (
        <div className="glass-panel p-5 rounded-2xl flex flex-wrap items-center gap-4 no-print animate-slide-up mb-6">
          <div className="flex items-center gap-2 text-slate-300 font-bold ml-2">
            <Filter size={18} className="text-blue-400" /> تصفية حسب تاريخ الإضافة:
          </div>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="premium-input !py-2 !w-48 !rounded-xl text-sm bg-slate-900"
          >
            <option value="all">عرض الكل</option>
            <option value="3days">آخر 3 أيام</option>
            <option value="1week">آخر أسبوع</option>
            <option value="2weeks">آخر أسبوعين</option>
            <option value="1month">آخر شهر</option>
            <option value="custom">مخصص (بالأيام)</option>
          </select>
          {timeFilter === "custom" && (
            <input
              type="number"
              min="1"
              placeholder="عدد الأيام"
              value={customTimeDays}
              onChange={(e) => setCustomTimeDays(e.target.value)}
              className="premium-input !py-2 !w-32 !rounded-xl text-sm"
            />
          )}
        </div>
      )}

      {/* ─── Customers Category Filter ───────────────────────────────────── */}
      {isCustomers && !isAdding && (
        <div className="glass-panel p-5 rounded-2xl flex flex-wrap items-center gap-4 no-print animate-slide-up">
          <div className="flex items-center gap-2 text-slate-300 font-bold ml-2">
            <Filter size={18} className="text-blue-400" /> تصنيف العملاء:
          </div>
          <select
            value={filters.category || ""}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="premium-input !py-2 !w-48 !rounded-xl text-sm bg-slate-900"
          >
            <option value="">-- عرض الكل --</option>
            <option value="مستثمر سابق">مستثمر سابق</option>
            <option value="مستثمر حالي">مستثمر حالي</option>
            <option value="مالك وحدة سكنية">مالك وحدة سكنية</option>
            {customCategories.map((c) => (
              <option key={c.Id} value={c.Name}>
                {c.Name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setFilters({})}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm transition-all font-bold"
          >
            مسح الفلاتر
          </button>
        </div>
      )}

      {/* ─── Communications Status Filter ───────────────────────────────── */}
      {(isRequestedComms || isComms) && !isAdding && (
        <div className="glass-panel p-5 rounded-2xl flex flex-wrap items-center gap-4 no-print animate-slide-up mb-6">
          <div className="flex items-center gap-2 text-slate-300 font-bold ml-2">
            <Filter size={18} className="text-blue-400" /> تصفية حالة الاتصال:
          </div>
          <select
            value={filters.requestedStatus || ""}
            onChange={(e) => setFilters({ ...filters, requestedStatus: e.target.value })}
            className="premium-input !py-2 !w-48 !rounded-xl text-sm bg-slate-900"
          >
            <option value="">عرض الكل</option>
            <option value="مطلوب">بانتظار الاتصال (مطلوب)</option>
            <option value="تم الاتصال">تم الاتصال بها</option>
            <option value="إعادة اتصال">إعادة اتصال</option>
            <option value="غير متوفر">غير متوفر</option>
            <option value="قيد الانتظار">قيد الانتظار</option>
          </select>
          <button
            onClick={() => setFilters({})}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm transition-all font-bold"
          >
            مسح الفلاتر
          </button>
        </div>
      )}

      {/* ─── Communications Result Filter ───────────────────────────────── */}
      {isComms && !isAdding && (
        <div className="glass-panel p-5 rounded-2xl flex flex-wrap items-center gap-4 no-print animate-slide-up">
          <div className="flex items-center gap-2 text-slate-300 font-bold ml-2">
            <Filter size={18} className="text-blue-400" /> تصفية حسب النتيجة:
          </div>
          <select
            value={filters.result || ""}
            onChange={(e) => setFilters({ ...filters, result: e.target.value })}
            className="premium-input !py-2 !w-48 !rounded-xl text-sm bg-slate-900"
          >
            <option value="">-- عرض الكل --</option>
            <option value="ممتازة">ممتازة</option>
            <option value="جيدة">جيدة</option>
            <option value="متوسطة">متوسطة</option>
            <option value="غير جيدة">غير جيدة</option>
            <option value="سيئة">سيئة</option>
          </select>
          <button
            onClick={() => setFilters({})}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-sm transition-all font-bold"
          >
            مسح الفلاتر
          </button>
        </div>
      )}
    </>
  );
};

export default SmartFilters;
