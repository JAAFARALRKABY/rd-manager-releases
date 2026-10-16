import React from "react";
import { FileText, Download } from "lucide-react";
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
  TableLayoutType,
  PageNumber
} from "docx";
import { saveAs } from "file-saver";

// Arabic-safe font stack — Tahoma is pre-installed on Windows and supports Arabic perfectly
const ARABIC_FONT = "Tahoma, Arial, sans-serif";

const ExportButtons = ({
  elementId,
  filename,
  records = [],
  subName = "",
  user,
  allSystemUsers = [],
  beforeExport,
}) => {
  // ─── Column definitions ────────────────────────────────────────────────────
  const getColumns = () => {
    let cols = [];
    if (subName.includes("عقار")) {
      cols = [
        { key: "sellerName",       label: "اسم البائع",      wordW: 14 },
        { key: "realEstateStatus", label: "الحالة",           wordW: 9  },
        { key: "city",             label: "المدينة",          wordW: 9  },
        { key: "area",             label: "المنطقة",          wordW: 11 },
        { key: "type",             label: "نوع العقار",       wordW: 10 },
        { key: "price",            label: "السعر",            wordW: 11 },
        { key: "phone",            label: "رقم الهاتف",       wordW: 11 },
        { key: "details",          label: "التفاصيل",         wordW: 25 },
      ];
    } else if (subName.includes("مطلوب") && subName.includes("اتصال")) {
      cols = [
        { key: "customerName", label: "اسم العميل",  wordW: 22 },
        { key: "phone",        label: "رقم الهاتف",  wordW: 18 },
        { key: "notes",        label: "الملاحظات",   wordW: 38 },
        { key: "status",       label: "حالة الطلب",  wordW: 12 },
      ];
    } else if (subName.includes("متابعة")) {
      cols = [
        { key: "callRecordId",    label: "رقم الاتصال",    wordW: 15 },
        { key: "followUpType",    label: "نوع المتابعة",   wordW: 15 },
        { key: "followUpDate",    label: "تاريخ المتابعة", wordW: 15 },
        { key: "details",         label: "تفاصيل المتابعة", wordW: 45 },
      ];
    } else if (subName.includes("اتصال")) {
      cols = [
        { key: "name",    label: "الجهة المتصلة",       wordW: 22 },
        { key: "phone",   label: "رقم الهاتف",           wordW: 16 },
        { key: "result",  label: "النتيجة",              wordW: 14 },
        { key: "details", label: "التفاصيل",             wordW: 38 },
      ];
    } else if (subName.includes("مواعيد")) {
      cols = [
        { key: "title",    label: "عنوان الموعد",   wordW: 24 },
        { key: "phone",    label: "رقم الهاتف",     wordW: 16 },
        { key: "datetime", label: "الوقت والتاريخ", wordW: 18 },
        { key: "details",  label: "التفاصيل",       wordW: 32 },
      ];
    } else if (subName.includes("عملا")) {
      cols = [
        { key: "name",     label: "اسم العميل",      wordW: 20 },
        { key: "phone",    label: "رقم الهاتف",      wordW: 15 },
        { key: "callDate", label: "تاريخ الاتصال",   wordW: 14 },
        { key: "category", label: "التصنيف",         wordW: 13 },
        { key: "details",  label: "التفاصيل",        wordW: 28 },
      ];
    } else if (subName.includes("وكلا") || subName.includes("دلال")) {
      cols = [
        { key: "agentName",       label: "اسم الوكيل",    wordW: 20 },
        { key: "officeName",      label: "اسم المكتب",    wordW: 20 },
        { key: "phone",           label: "رقم الهاتف",    wordW: 16 },
        { key: "officeLocation",  label: "الموقع",        wordW: 16 },
        { key: "responsibleArea", label: "المنطقة",       wordW: 18 },
      ];
    } else {
      const hasPhone = records.some((r) => {
        let d = {};
        try { d = JSON.parse(r.Content); } catch (e) {}
        return d.phone && d.phone.trim() !== "";
      });
      cols = [
        { key: "title", label: "العنوان",         wordW: 22 },
        { key: "extra", label: "معلومة إضافية",   wordW: 20 },
      ];
      if (hasPhone) cols.push({ key: "phone", label: "رقم الهاتف", wordW: 16 });
      cols.push({ key: "details", label: "التفاصيل", wordW: 32 });
    }
    return [{ key: "_serial", label: "#", wordW: 5 }, ...cols];
  };

  const getCellValue = (data, col) => {
    let val = data[col.key] || "-";
    if (col.key === "price" && val !== "-") val = Number(val).toLocaleString("en-US") + " د.ع";
    if (col.key === "result"   && val === "مخصص" && data.customResult)   val = data.customResult;
    if (col.key === "category" && val === "مخصص" && data.customCategory) val = data.customCategory;
    return String(val);
  };

  // ─── PDF EXPORT ───────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!records || records.length === 0) {
      import("react-hot-toast").then((m) => m.default.error("لا توجد بيانات للتصدير"));
      return;
    }
    if (beforeExport) {
      import("react-hot-toast").then((m) =>
        m.default.loading("جاري تحضير الملف...", { id: "pdf-loading" })
      );
      await beforeExport();
      import("react-hot-toast").then((m) => m.default.dismiss("pdf-loading"));
    }

    const columns = getColumns();
    const dateStr  = formatBaghdadTime(new Date(), false);
    const userStr  = user?.FullName || user?.Username || "النظام";

    // Chunk records: 5 on first page, 5 on subsequent pages
    const chunks = [];
    if (records.length > 0) {
      chunks.push(records.slice(0, 5));
      for (let i = 5; i < records.length; i += 5) {
        chunks.push(records.slice(i, i + 5));
      }
    }
    const totalPages = chunks.length || 1;

    const headerCells = [
      ...columns.map((c) => `
        <th style="
          padding:10px 8px; background:#1E3A8A; color:#fff;
          font-size:13px; font-weight:bold;
          border-left:1px solid rgba(255,255,255,0.15);
          white-space:nowrap;
        ">${c.label}</th>`),
      `<th style="padding:10px 8px;background:#1E3A8A;color:#fff;font-size:13px;font-weight:bold;border-left:1px solid rgba(255,255,255,0.15);white-space:nowrap;">أضيف بواسطة</th>`,
      `<th style="padding:10px 8px;background:#1E3A8A;color:#fff;font-size:13px;font-weight:bold;white-space:nowrap;">تاريخ الإضافة</th>`,
    ].join("");

    const renderPageToImage = async (chunk, pageIndex) => {
      const startIndex = pageIndex * 5;
      
      const rowsHtml = chunk.map((rec, i) => {
        let data = {};
        try { data = JSON.parse(rec.Content); } catch (e) {}
        const bg = i % 2 === 0 ? "#F0F5FF" : "#FFFFFF";
        const creator = allSystemUsers?.find((u) => u.Id === rec.CreatedBy_UserId);
        const creatorName = creator ? creator.FullName || creator.Username : "-";

        const dataCells = columns.map((c) => {
          const val = c.key === "_serial" ? String(startIndex + i + 1) : getCellValue(data, c);
          const isPhone = c.key === "phone";
          const isDetails = c.key === "details" || c.key === "notes";
          const isSerial = c.key === "_serial";
          return `<td style="
            padding:8px 8px;
            border:1px solid #D1D9F0;
            color:#1a2545; font-size:13px; font-weight:500;
            ${isSerial ? "white-space:nowrap; text-align:center;" : "word-break:break-word;"}
            ${isPhone ? "direction:ltr;text-align:right;font-family:monospace;font-weight:bold;color:#1E40AF;" : ""}
            ${isDetails ? "max-width:220px;font-size:12px;" : ""}
            ${isSerial ? "font-weight:bold; color:#64748B; text-align:center;" : ""}
          ">${val}</td>`;
        }).join("");

        return `<tr style="background:${bg};">
          ${dataCells}
          <td style="padding:8px 8px;border:1px solid #D1D9F0;color:#334155;font-size:12px;font-weight:bold;white-space:nowrap;">${creatorName}</td>
          <td style="padding:8px 8px;border:1px solid #D1D9F0;color:#334155;font-size:12px;white-space:nowrap;">${formatBaghdadTime(rec.CreatedAt, false)}</td>
        </tr>`;
      }).join("");

      const isFirstPage = pageIndex === 0;

      const headerHtml = isFirstPage ? `
        <!-- ══ HEADER ══ -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <div style="font-size:26px;font-weight:900;color:#1E3A8A;letter-spacing:0;">شركة المستشار المؤسسي</div>
            <div style="font-size:13px;color:#64748B;font-weight:600;margin-top:3px;">قسم البحث والتطوير</div>
          </div>
          <div style="text-align:left;display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
            <div style="background:#1E3A8A;color:#fff;border-radius:8px;padding:5px 14px;font-size:12px;font-weight:bold;">
              📅 ${dateStr}
            </div>
            <div style="color:#64748B;font-size:11px;background:#F1F5F9;padding:3px 10px;border-radius:6px;border:1px solid #E2E8F0;">
              بواسطة: ${userStr}
            </div>
          </div>
        </div>
        <div style="height:4px;background:linear-gradient(90deg,#1E3A8A,#3B82F6,#1E3A8A);border-radius:2px;margin-bottom:16px;"></div>
        <div style="
          background:linear-gradient(135deg,#1E3A8A,#2563EB);
          border-radius:12px;padding:16px 22px;margin-bottom:18px;
          box-shadow:0 6px 20px rgba(30,58,138,0.25);
        ">
          <div style="font-size:20px;font-weight:900;color:#fff;">تقرير قسم: ${filename}</div>
          <div style="font-size:12px;color:#BFDBFE;margin-top:4px;">إجمالي السجلات: ${records.length} سجل</div>
        </div>
      ` : `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:2px solid #1E3A8A;padding-bottom:10px;">
          <div style="font-size:16px;font-weight:bold;color:#1E3A8A;">تقرير قسم: ${filename} - تكملة</div>
          <div style="font-size:12px;color:#64748B;">تاريخ الإصدار: ${dateStr}</div>
        </div>
      `;

      const html = `
        <div style="
          width:297mm; height:210mm; padding:12mm 15mm;
          background:#fff; color:#000; direction:rtl;
          font-family:${ARABIC_FONT};
          box-sizing:border-box;
          position:relative;
        ">
          ${headerHtml}
          <table style="
            width:100%;border-collapse:collapse;text-align:right;
            font-size:13px;font-family:${ARABIC_FONT};
            border:2px solid #1E3A8A;
          ">
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="position:absolute; bottom:12mm; left:15mm; right:15mm; padding-top:10px;border-top:2px dashed #BFDBFE;display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:12px;color:#64748B;font-weight:bold;">
              © ${new Date().getFullYear()} شركة المستشار المؤسسي — جميع الحقوق محفوظة
            </div>
            <div style="font-size:12px;color:#64748B;font-weight:bold;">
              الصفحة ${pageIndex + 1} من ${totalPages}
            </div>
            <div style="font-size:12px;color:#3B82F6;background:#EFF6FF;padding:4px 12px;border-radius:6px;border:1px solid #BFDBFE;font-weight:bold;">
              RD Manager ™
            </div>
          </div>
        </div>
      `;

      const div = document.createElement("div");
      div.style.position = "fixed";
      div.style.left = "-9999px";
      div.style.top = "0";
      div.style.zIndex = "-1";
      div.innerHTML = html;
      document.body.appendChild(div);

      const imgData = await htmlToImage.toPng(div.firstElementChild, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)", transformOrigin: "top right" },
      });
      document.body.removeChild(div);
      return imgData;
    };

    try {
      const pdf = new jsPDF("l", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) pdf.addPage();
        const imgData = await renderPageToImage(chunks[i], i);
        pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH, undefined, "FAST");
      }
      
      pdf.save(`${filename}.pdf`);
    } catch (err) {
      console.error(err);
      import("react-hot-toast").then((m) => m.default.error("حدث خطأ أثناء التصدير إلى PDF"));
    }
  };

  // ─── WORD EXPORT ──────────────────────────────────────────────────────────
  const handleExportWord = async () => {
    if (!records || records.length === 0) {
      import("react-hot-toast").then((m) => m.default.error("لا توجد بيانات للتصدير"));
      return;
    }
    if (beforeExport) {
      import("react-hot-toast").then((m) =>
        m.default.loading("جاري تحضير ملف Word...", { id: "word-loading" })
      );
      await beforeExport();
      import("react-hot-toast").then((m) => m.default.dismiss("word-loading"));
    }

    try {
      const columns  = getColumns();
      const dateStr  = formatBaghdadTime(new Date(), false);
      const userStr  = user?.FullName || user?.Username || "النظام";

      // Total landscape A4 usable width ≈ 12240 DXA (8.5 in × 1440 − margins)
      // We distribute based on wordW percentages
      const totalW   = columns.reduce((s, c) => s + c.wordW, 0) + 14; // 14 = addedBy(7) + date(7)
      const toDXA    = (pct) => Math.round((pct / totalW) * 12240);

      const mkRun = (text, opts = {}) =>
        new TextRun({ text: String(text), rightToLeft: true, font: "Arial", size: 22, color: "1a2545", ...opts });

      const mkHeaderCell = (label, pct) =>
        new TableCell({
          children: [new Paragraph({
            children: [mkRun(label, { bold: true, size: 22, color: "FFFFFF" })],
            alignment: AlignmentType.CENTER, bidi: true,
          })],
          margins: { top: 130, bottom: 130, left: 100, right: 100 },
          shading: { fill: "1E3A8A", type: ShadingType.CLEAR, color: "auto" },
          width: { size: toDXA(pct), type: WidthType.DXA },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: "2563EB" },
            bottom: { style: BorderStyle.THICK,  size: 8, color: "93C5FD" },
            left:   { style: BorderStyle.SINGLE, size: 3, color: "2563EB" },
            right:  { style: BorderStyle.SINGLE, size: 3, color: "2563EB" },
          },
        });

      const mkDataCell = (val, pct, rowFill, isDetails = false) =>
        new TableCell({
          children: [new Paragraph({
            children: [mkRun(String(val).substring(0, isDetails ? 400 : 9999), { size: isDetails ? 18 : 20 })],
            alignment: AlignmentType.RIGHT, bidi: true,
          })],
          margins: { top: 120, bottom: 120, left: 100, right: 100 },
          shading: { fill: rowFill, type: ShadingType.CLEAR, color: "auto" },
          width: { size: toDXA(pct), type: WidthType.DXA },
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
            bottom: { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
            left:   { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
            right:  { style: BorderStyle.SINGLE, size: 3, color: "DBEAFE" },
          },
        });

      const headerRow = new TableRow({
        tableHeader: true,
        children: [
          ...columns.map((c) => mkHeaderCell(c.label, c.wordW)),
          mkHeaderCell("أضيف بواسطة", 7),
          mkHeaderCell("تاريخ الإضافة", 7),
        ],
      });

      // Data rows
      const dataRows = records.map((rec, i) => {
        let data = {};
        try { data = JSON.parse(rec.Content); } catch (e) {}
        const rowFill   = i % 2 === 0 ? "EFF6FF" : "FFFFFF";
        const creator   = allSystemUsers?.find((u) => u.Id === rec.CreatedBy_UserId);
        const creatorName = creator ? creator.FullName || creator.Username : "-";

        return new TableRow({
          children: [
            ...columns.map((c) =>
              mkDataCell(c.key === "_serial" ? (i + 1) : getCellValue(data, c), c.wordW, rowFill, c.key === "details" || c.key === "notes")
            ),
            mkDataCell(creatorName, 7, rowFill),
            mkDataCell(formatBaghdadTime(rec.CreatedAt, false), 7, rowFill),
          ],
        });
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: { orientation: PageOrientation.LANDSCAPE },
              margin: { top: 800, right: 800, bottom: 800, left: 800 },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "شركة المستشار المؤسسي", bold: true, size: 38, color: "1E3A8A", font: "Arial", rightToLeft: true }),
                    new TextRun({ text: "   |   قسم البحث والتطوير", size: 26, color: "64748B", font: "Arial", rightToLeft: true }),
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
                  children: [
                    new TextRun({
                      text: `© ${new Date().getFullYear()} شركة المستشار المؤسسي — تم الإصدار: ${dateStr}  |  بواسطة: ${userStr}  |  RD Manager ™    |    الصفحة `,
                      size: 18, color: "94A3B8", font: "Arial", rightToLeft: true,
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 18, color: "94A3B8", font: "Arial",
                    }),
                    new TextRun({
                      text: " من ",
                      size: 18, color: "94A3B8", font: "Arial", rightToLeft: true,
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 18, color: "94A3B8", font: "Arial",
                    }),
                  ],
                  alignment: AlignmentType.CENTER, bidi: true,
                  border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DBEAFE", space: 6 } },
                }),
              ],
            }),
          },
          children: [
            new Paragraph({
              children: [new TextRun({ text: `تقرير قسم: ${filename}`, bold: true, size: 48, color: "0F172A", font: "Arial", rightToLeft: true })],
              alignment: AlignmentType.CENTER, bidi: true,
              spacing: { before: 200, after: 140 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `إجمالي السجلات: `, size: 22, color: "64748B", font: "Arial", rightToLeft: true }),
                new TextRun({ text: `${records.length} سجل`, bold: true, size: 26, color: "1E3A8A", font: "Arial", rightToLeft: true }),
                new TextRun({ text: `   |   تاريخ الإصدار: ${dateStr}`, size: 22, color: "64748B", font: "Arial", rightToLeft: true }),
              ],
              alignment: AlignmentType.CENTER, bidi: true,
              spacing: { after: 300 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFDBFE", space: 8 } },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              layout: TableLayoutType.FIXED,
              visuallyRightToLeft: true,
              rows: [headerRow, ...dataRows],
              borders: {
                top:    { style: BorderStyle.DOUBLE, size: 8, color: "1E3A8A" },
                bottom: { style: BorderStyle.DOUBLE, size: 8, color: "1E3A8A" },
                left:   { style: BorderStyle.DOUBLE, size: 8, color: "1E3A8A" },
                right:  { style: BorderStyle.DOUBLE, size: 8, color: "1E3A8A" },
              },
            }),
          ],
        }],
      });

      Packer.toBlob(doc).then((blob) => saveAs(blob, `${filename}.docx`));
    } catch (error) {
      console.error("Word export error:", error);
      import("react-hot-toast").then((m) => m.default.error("حدث خطأ أثناء التصدير إلى Word"));
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleExportPDF}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700 hover:border-red-500/30 shadow-sm text-xs font-bold"
        title="تصدير تقرير PDF احترافي"
      >
        <FileText size={16} /> <span className="hidden sm:inline">PDF</span>
      </button>
      <button
        onClick={handleExportWord}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 rounded-xl transition-all border border-slate-700 hover:border-blue-500/30 shadow-sm text-xs font-bold"
        title="تصدير تقرير Word احترافي"
      >
        <Download size={16} /> <span className="hidden sm:inline">Word</span>
      </button>
    </div>
  );
};

export default ExportButtons;
