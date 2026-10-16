import React, { useState } from "react";
import { FileText, Download, UserCheck } from "lucide-react";
import { formatBaghdadTime } from "../../utils/dateUtils";
import * as htmlToImage from "html-to-image";
import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  AlignmentType,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageOrientation,
} from "docx";
import { saveAs } from "file-saver";
import { toast } from "react-hot-toast";

const TRANSLATIONS = {
  city: "المدينة",
  area: "المنطقة",
  title: "العنوان",
  name: "الاسم",
  customerName: "اسم العميل",
  sellerName: "اسم البائع",
  phone: "رقم الهاتف",
  details: "التفاصيل",
  notes: "ملاحظات",
  price: "السعر",
  type: "نوع العقار",
  realEstateStatus: "حالة العقار",
  agentName: "اسم الوكيل",
  officeName: "اسم المكتب",
  officeLocation: "موقع المكتب",
  responsibleArea: "مناطق العمل",
  result: "نتيجة الاتصال",
  category: "التصنيف",
  callDate: "تاريخ الاتصال",
  contactDate: "تاريخ الاتصال",
  datetime: "وقت الموعد",
  status: "الحالة",
  assignedToUserId: "مخصص للموظف",
  location: "الموقع",
  locationUrl: "رابط الموقع",
  followUpType: "نوع المتابعة",
  followUpDate: "تاريخ المتابعة",
  callRecordId: "الاتصال السابق (رقم المعرف)",
};

const SKIP_KEYS = ["points", "uiAcknowledge", "reminded", "customResult", "customCategory", "reminder", "customReminder", "locationUrl"];

const SingleRecordExport = ({ record, parsedData, subDepartmentName, user, allUsers }) => {
  const [isExporting, setIsExporting] = useState(false);

  const creator = allUsers?.find((u) => u.Id === record.CreatedBy_UserId);
  const creatorName = creator ? creator.FullName || creator.Username : "غير معروف";

  const getRecordTitle = () =>
    parsedData.city
      ? `${parsedData.city} - ${parsedData.area || ""}`
      : parsedData.sellerName || parsedData.title || parsedData.name || parsedData.customerName || "سجل بدون اسم";

  const getDisplayFields = (isCustomer = false) =>
    Object.entries(parsedData).filter(([key, val]) => {
      if (!val || val === "") return false;
      if (SKIP_KEYS.includes(key)) return false;
      if (isCustomer) {
        // Only allow certain fields for customer
        const allowedForCustomer = ["city", "area", "price", "type", "details", "notes", "realEstateStatus"];
        if (!allowedForCustomer.includes(key)) return false;
      }
      return true;
    }).flatMap(([key, val]) => {
      let label = TRANSLATIONS[key] || key;
      let displayVal = String(val);
      if (key === "price") displayVal = Number(val).toLocaleString("en-US") + " د.ع";
      if (key === "result" && val === "مخصص" && parsedData.customResult) displayVal = parsedData.customResult;
      if (key === "category" && val === "مخصص" && parsedData.customCategory) displayVal = parsedData.customCategory;
      if (key === "assignedToUserId") {
        const assignedUser = Array.isArray(allUsers) && allUsers.find(u => String(u.Id) === String(val));
        displayVal = assignedUser ? (assignedUser.FullName || assignedUser.Username) : "مجهول";
      }
      
      // Break very long text fields into smaller chunks to allow pagination
      if (displayVal.length > 350 && (key === "details" || key === "notes" || key === "content" || key === "FollowUpDetails")) {
        const chunks = displayVal.match(/.{1,350}(\s|$)/g) || [displayVal];
        return chunks.map((chunk, idx) => ({
          label: idx === 0 ? label : `${label} (تكملة)`,
          value: chunk,
          isPhone: false,
          isPrice: false
        }));
      }

      return [{ label, value: displayVal, isPhone: key === "phone", isPrice: key === "price" }];
    });

  // ─────────────────────────────────────────────────────────────────
  // PDF
  // ─────────────────────────────────────────────────────────────────
  const generatePagesHtml = (isCustomer = false) => {
    const title = getRecordTitle();
    const dateStr = formatBaghdadTime(new Date(), false);
    const addedDateStr = formatBaghdadTime(record.CreatedAt, false);
    const fields = getDisplayFields(isCustomer);

    const mkCard = (f) => `
      <div style="
        display:flex; justify-content:space-between; align-items:flex-start;
        padding: 12px 16px;
        border-radius: 10px;
        background: #F8FAFF;
        border: 1px solid #DBEAFE;
        border-right: 4px solid #2563EB;
        margin-bottom: 12px;
      ">
        <div style="font-size:16px; font-weight:900; color:#1a2545; word-break:break-word; max-width:65%;
          ${f.isPhone ? "direction:ltr; text-align:right; font-family:monospace; color:#1E40AF;" : ""}
          ${f.isPrice ? "color:#059669; font-size:18px;" : ""}
        ">${f.value}</div>
        <div style="font-size:12px; font-weight:700; color:#64748B; white-space:nowrap; padding-right:8px; padding-top:2px;">${f.label}</div>
      </div>
    `;

    // 8 fields per page is safe for A4 Portrait
    const fieldsPerPage = 8;
    const pagesFields = [];
    for (let i = 0; i < fields.length; i += fieldsPerPage) {
      pagesFields.push(fields.slice(i, i + fieldsPerPage));
    }
    if (pagesFields.length === 0) pagesFields.push([]);

    const totalPages = pagesFields.length;
    const pagesHtml = [];

    pagesFields.forEach((chunkFields, pageIndex) => {
      const half = Math.ceil(chunkFields.length / 2);
      const col1 = chunkFields.slice(0, half);
      const col2 = chunkFields.slice(half);

      const isFirstPage = pageIndex === 0;

      let headerSection = '';
      if (isFirstPage) {
        headerSection = `
          <!-- ══════ TOP STRIPE ══════ -->
          <div style="height:8px; background:linear-gradient(90deg,#1E3A8A,#3B82F6,#60A5FA,#3B82F6,#1E3A8A); border-radius:4px; margin-bottom:22px;"></div>
          
          <!-- ══════ HEADER ══════ -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
            <div>
              <div style="font-size:26px; font-weight:900; color:#1E3A8A; letter-spacing:-0.5px;">شركة المستشار المؤسسي</div>
              <div style="font-size:13px; color:#94A3B8; font-weight:600; margin-top:3px;">قسم: ${subDepartmentName}</div>
            </div>
            <div style="text-align:left; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
              <div style="background:#1E3A8A; color:#fff; border-radius:8px; padding:5px 14px; font-size:12px; font-weight:bold;">
                رقم السجل: #${record.Id}
              </div>
              <div style="color:#64748B; font-size:11px; background:#F1F5F9; padding:4px 10px; border-radius:6px; border:1px solid #E2E8F0;">
                تاريخ الطباعة: ${dateStr}
              </div>
            </div>
          </div>

          <!-- ══════ TITLE BANNER ══════ -->
          <div style="
            background: linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 50%, #2563EB 100%);
            border-radius: 14px;
            padding: 20px 24px;
            margin-bottom: 22px;
            box-shadow: 0 8px 25px rgba(30,58,138,0.3);
            position:relative; overflow:hidden;
          ">
            <div style="font-size:24px; font-weight:900; color:#fff; position:relative; z-index:1;">${title}</div>
            <div style="font-size:13px; color:#BFDBFE; margin-top:6px; position:relative; z-index:1;">${isCustomer ? "تفاصيل عرض العقار" : "تقرير تفصيلي شامل"}</div>
          </div>

          <!-- ══════ META CARDS ══════ -->
          ${!isCustomer ? `
          <div style="display:flex; gap:14px; margin-bottom:24px;">
            <div style="flex:1; border:1px solid #DBEAFE; border-top:4px solid #3B82F6; border-radius:10px; padding:14px; text-align:center; background:#F8FAFF;">
              <div style="font-size:11px; color:#64748B; font-weight:700; margin-bottom:5px;">أضيف بواسطة</div>
              <div style="font-size:16px; font-weight:900; color:#1E3A8A;">${creatorName}</div>
            </div>
            <div style="flex:1; border:1px solid #DBEAFE; border-top:4px solid #3B82F6; border-radius:10px; padding:14px; text-align:center; background:#F8FAFF;">
              <div style="font-size:11px; color:#64748B; font-weight:700; margin-bottom:5px;">تاريخ الإضافة</div>
              <div style="font-size:16px; font-weight:900; color:#1E3A8A;">${addedDateStr}</div>
            </div>
            <div style="flex:1; border:1px solid #DBEAFE; border-top:4px solid #3B82F6; border-radius:10px; padding:14px; text-align:center; background:#F8FAFF;">
              <div style="font-size:11px; color:#64748B; font-weight:700; margin-bottom:5px;">القسم</div>
              <div style="font-size:15px; font-weight:900; color:#1E3A8A;">${subDepartmentName}</div>
            </div>
          </div>
          ` : ''}
          
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
            <div style="height:2px; flex:1; background:#DBEAFE;"></div>
            <div style="font-size:14px; font-weight:900; color:#1E3A8A; padding:4px 16px; border:2px solid #DBEAFE; border-radius:20px; background:#EFF6FF;">
              تفاصيل السجل
            </div>
            <div style="height:2px; flex:1; background:#DBEAFE;"></div>
          </div>
        `;
      } else {
        headerSection = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:2px solid #1E3A8A; padding-bottom:12px;">
            <div style="font-size:18px; font-weight:bold; color:#1E3A8A;">${title} - تكملة</div>
            <div style="font-size:12px; color:#64748B;">رقم السجل: #${record.Id} | ${dateStr}</div>
          </div>
        `;
      }

      const html = `
        <div style="width:210mm; height:297mm; padding:15mm 15mm; background:#fff; color:#000; direction:rtl; font-family:Tahoma,Arial,sans-serif; box-sizing:border-box; position:relative;">
          ${headerSection}

          <!-- ══════ TWO-COLUMN FIELDS ══════ -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 16px;">
            <div>${col1.map(mkCard).join("")}</div>
            <div>${col2.map(mkCard).join("")}</div>
          </div>

          <!-- ══════ FOOTER ══════ -->
          <div style="position:absolute; bottom:15mm; left:15mm; right:15mm;">
            <div style="height:2px; background:linear-gradient(90deg,#1E3A8A,#3B82F6,#1E3A8A); border-radius:2px; margin-bottom:12px;"></div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:12px; color:#94A3B8; font-weight:bold;">
                © ${new Date().getFullYear()} شركة المستشار المؤسسي — جميع الحقوق محفوظة
              </div>
              <div style="font-size:12px; color:#64748B; font-weight:bold;">
                الصفحة ${pageIndex + 1} من ${totalPages}
              </div>
              <div style="font-size:12px; color:#3B82F6; background:#EFF6FF; padding:4px 12px; border-radius:6px; border:1px solid #BFDBFE; font-weight:bold;">
                RD Manager ™
              </div>
            </div>
          </div>
        </div>
      `;
      pagesHtml.push(html);
    });

    return pagesHtml;
  };

  const handleExportPDF = async (e, isCustomer = false) => {
    e.stopPropagation();
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading("جاري إنشاء PDF الاحترافي...");
    try {
      const pagesHtml = generatePagesHtml(isCustomer);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pagesHtml.length; i++) {
        if (i > 0) pdf.addPage();
        const div = document.createElement("div");
        div.style.position = "fixed";
        div.style.left = "-9999px";
        div.style.top = "0";
        div.style.zIndex = "-1";
        div.innerHTML = pagesHtml[i];
        document.body.appendChild(div);

        const imgData = await htmlToImage.toPng(div.firstElementChild, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          style: { transform: "scale(1)", transformOrigin: "top left" }
        });
        document.body.removeChild(div);

        pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH, undefined, "FAST");
      }
      
      const filenamePrefix = isCustomer ? "عرض-للزبون" : "سجل";
      pdf.save(`${filenamePrefix}-${record.Id}-${getRecordTitle().substring(0, 30)}.pdf`);
      toast.success("تم تصدير PDF بنجاح!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("خطأ في تصدير PDF", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // WORD
  // ─────────────────────────────────────────────────────────────────
  const handleExportWord = async (e) => {
    e.stopPropagation();
    if (isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading("جاري تنسيق ملف Word...");
    try {
      const title = getRecordTitle();
      const dateStr = formatBaghdadTime(new Date(), false);
      const addedDateStr = formatBaghdadTime(record.CreatedAt, false);
      const fields = getDisplayFields();

      const mkRun = (text, opts = {}) =>
        new TextRun({ text: String(text), rightToLeft: true, font: "Arial", size: 22, color: "1a2545", ...opts });

      // Meta info table (3 columns)
      const metaTable = new Table({
        width: { size: 9000, type: WidthType.DXA },
        visuallyRightToLeft: true,
        borders: {
          top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ children: [mkRun("القسم", { size: 18, color: "64748B" })], alignment: AlignmentType.CENTER, bidi: true }),
                  new Paragraph({ children: [mkRun(subDepartmentName, { bold: true, size: 24, color: "1E3A8A" })], alignment: AlignmentType.CENTER, bidi: true }),
                ],
                width: { size: 3000, type: WidthType.DXA },
                borders: {
                  top: { style: BorderStyle.THICK, size: 6, color: "2563EB" },
                  bottom: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                  left: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                  right: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                },
                shading: { fill: "EFF6FF", type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 160, bottom: 160, left: 100, right: 100 },
              }),
              new TableCell({
                children: [
                  new Paragraph({ children: [mkRun("أضيف بواسطة", { size: 18, color: "64748B" })], alignment: AlignmentType.CENTER, bidi: true }),
                  new Paragraph({ children: [mkRun(creatorName, { bold: true, size: 24, color: "1E3A8A" })], alignment: AlignmentType.CENTER, bidi: true }),
                ],
                width: { size: 3000, type: WidthType.DXA },
                borders: {
                  top: { style: BorderStyle.THICK, size: 6, color: "2563EB" },
                  bottom: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                  left: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                  right: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                },
                shading: { fill: "EFF6FF", type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 160, bottom: 160, left: 100, right: 100 },
              }),
              new TableCell({
                children: [
                  new Paragraph({ children: [mkRun("تاريخ الإضافة", { size: 18, color: "64748B" })], alignment: AlignmentType.CENTER, bidi: true }),
                  new Paragraph({ children: [mkRun(addedDateStr, { bold: true, size: 24, color: "1E3A8A" })], alignment: AlignmentType.CENTER, bidi: true }),
                ],
                width: { size: 3000, type: WidthType.DXA },
                borders: {
                  top: { style: BorderStyle.THICK, size: 6, color: "2563EB" },
                  bottom: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                  left: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                  right: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                },
                shading: { fill: "EFF6FF", type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 160, bottom: 160, left: 100, right: 100 },
              }),
            ],
          }),
        ],
      });

      // Fields table
      const fieldRows = fields.map((f, i) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [mkRun(f.label, { bold: true, size: 22, color: "1E3A8A" })], alignment: AlignmentType.RIGHT, bidi: true })],
              shading: { fill: i % 2 === 0 ? "EFF6FF" : "F8FAFF", type: ShadingType.CLEAR, color: "auto" },
              margins: { top: 180, bottom: 180, left: 160, right: 200 },
              width: { size: 2500, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                bottom: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                right: { style: BorderStyle.THICK, size: 8, color: "2563EB" },
                left: { style: BorderStyle.NONE },
              },
            }),
            new TableCell({
              children: [new Paragraph({ children: [mkRun(f.value, { size: 24, bold: true, color: f.isPrice ? "059669" : "0F172A" })], alignment: f.isPhone ? AlignmentType.LEFT : AlignmentType.RIGHT, bidi: true })],
              shading: { fill: i % 2 === 0 ? "F8FAFF" : "FFFFFF", type: ShadingType.CLEAR, color: "auto" },
              margins: { top: 180, bottom: 180, left: 200, right: 160 },
              width: { size: 6500, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                bottom: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                left: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
                right: { style: BorderStyle.NONE },
              },
            }),
          ],
        })
      );

      const fieldsTable = new Table({
        width: { size: 9000, type: WidthType.DXA },
        visuallyRightToLeft: true,
        rows: fieldRows,
        borders: {
          top: { style: BorderStyle.DOUBLE, size: 6, color: "1E3A8A" },
          bottom: { style: BorderStyle.DOUBLE, size: 6, color: "1E3A8A" },
          left: { style: BorderStyle.DOUBLE, size: 6, color: "1E3A8A" },
          right: { style: BorderStyle.DOUBLE, size: 6, color: "1E3A8A" },
        },
      });

      const doc = new Document({
        sections: [{
          properties: { page: { margin: { top: 1000, right: 1100, bottom: 1000, left: 1100 } } },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "شركة المستشار المؤسسي", bold: true, size: 38, color: "1E3A8A", font: "Arial", rightToLeft: true }),
                    new TextRun({ text: "  —  قسم البحث والتطوير", size: 26, color: "64748B", font: "Arial", rightToLeft: true }),
                  ],
                  alignment: AlignmentType.CENTER, bidi: true,
                  border: { bottom: { style: BorderStyle.THICK, size: 12, color: "1E3A8A", space: 8 } },
                  spacing: { after: 200 },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [mkRun(`© ${new Date().getFullYear()} شركة المستشار المؤسسي | تم الإصدار: ${dateStr} | RD Manager ™`, { size: 16, color: "94A3B8" })],
                  alignment: AlignmentType.CENTER, bidi: true,
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DBEAFE", space: 6 } },
                }),
              ],
            }),
          },
          children: [
            // Title
            new Paragraph({
              children: [mkRun(`تقرير مفصّل — ${title}`, { bold: true, size: 44, color: "0F172A" })],
              alignment: AlignmentType.CENTER, bidi: true,
              spacing: { before: 200, after: 200 },
              border: { bottom: { style: BorderStyle.THICK, size: 10, color: "2563EB", space: 8 } },
            }),
            new Paragraph({ text: "", spacing: { after: 200 } }),
            // Section divider: meta
            new Paragraph({
              children: [mkRun("معلومات السجل الأساسية", { bold: true, size: 26, color: "1E3A8A" })],
              alignment: AlignmentType.RIGHT, bidi: true, spacing: { after: 160 },
            }),
            metaTable,
            new Paragraph({ text: "", spacing: { after: 300 } }),
            // Section divider: fields
            new Paragraph({
              children: [mkRun("تفاصيل السجل الكاملة", { bold: true, size: 26, color: "1E3A8A" })],
              alignment: AlignmentType.RIGHT, bidi: true, spacing: { after: 160 },
            }),
            fieldsTable,
          ],
        }],
      });

      Packer.toBlob(doc).then((blob) => {
        saveAs(blob, `سجل-${record.Id}-${title.substring(0, 30)}.docx`);
        toast.success("تم تصدير Word بنجاح!", { id: toastId });
      });
    } catch (err) {
      console.error(err);
      toast.error("خطأ في تصدير Word", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex gap-2 no-print">
      {subDepartmentName?.includes("عقار") && (
        <button
          onClick={(e) => handleExportPDF(e, true)}
          disabled={isExporting}
          className="flex items-center justify-center w-10 h-10 bg-slate-800/80 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded-xl transition-all border border-slate-700 hover:border-emerald-500/30 disabled:opacity-50 shadow-sm"
          title="تصدير للزبون (سعر ومواصفات فقط)"
        >
          <UserCheck size={18} />
        </button>
      )}
      <button
        onClick={(e) => handleExportPDF(e, false)}
        disabled={isExporting}
        className="flex items-center justify-center w-10 h-10 bg-slate-800/80 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700 hover:border-red-500/30 disabled:opacity-50 shadow-sm"
        title="تصدير PDF احترافي"
      >
        <FileText size={18} />
      </button>
      <button
        onClick={handleExportWord}
        disabled={isExporting}
        className="flex items-center justify-center w-10 h-10 bg-slate-800/80 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 rounded-xl transition-all border border-slate-700 hover:border-blue-500/30 disabled:opacity-50 shadow-sm"
        title="تصدير Word احترافي"
      >
        <Download size={18} />
      </button>
    </div>
  );
};

export default SingleRecordExport;
