import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface StockCardExportParams {
  products: any[];
  stockIn: any[];
  stockOut: any[];
  helpers: {
    getProductName: (id: string) => string;
    getProductUnit: (id: string) => string;
    getCategoryName: (id: string) => string;
    getCompanyName: (id: string) => string;
    getDepartmentName: (id: string) => string;
  };
  dateFrom?: Date;
}

async function saveFile(blob: Blob, defaultName: string) {
  if ("showSaveFilePicker" in window) {
    try {
      const ext = defaultName.split(".").pop() || "";
      const types: any[] = [];
      if (ext === "xlsx") {
        types.push({ description: "Excel Files", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } });
      } else if (ext === "pdf") {
        types.push({ description: "PDF Files", accept: { "application/pdf": [".pdf"] } });
      }
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultName,
        types,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e: any) {
      if (e.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function loadThaiFont(doc: jsPDF): Promise<boolean> {
  try {
    const res = await fetch("https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf");
    if (!res.ok) return false;
    const buffer = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    doc.addFileToVFS("Sarabun-Regular.ttf", base64);
    doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
    doc.setFont("Sarabun");
    return true;
  } catch {
    return false;
  }
}

export async function exportToExcel(data: ExportData): Promise<boolean> {
  const wsData = [data.headers, ...data.rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, data.title.substring(0, 31));
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return saveFile(blob, `${data.title}.xlsx`);
}

export async function exportToPDF(data: ExportData): Promise<boolean> {
  const doc = new jsPDF({ orientation: data.headers.length > 6 ? "landscape" : "portrait" });

  const hasThai = await loadThaiFont(doc);
  doc.setFontSize(16);
  doc.text(data.title, 14, 20);

  autoTable(doc, {
    head: [data.headers],
    body: data.rows.map(r => r.map(c => String(c))),
    startY: 30,
    styles: { fontSize: 9, ...(hasThai ? { font: "Sarabun" } : {}) },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const blob = doc.output("blob");
  return saveFile(blob, `${data.title}.pdf`);
}

// ======================== Stock Card Specific Exports ========================

function buildStockCardProductData(params: StockCardExportParams) {
  const { products, stockIn, stockOut, helpers, dateFrom } = params;

  return products.map((product, pIdx) => {
    const pIn = stockIn.filter((r: any) => r.product_id === product.id);
    const pOut = stockOut.filter((r: any) => r.product_id === product.id);
    const movements = [
      ...pIn.map((r: any) => ({ ...r, type: "in" })),
      ...pOut.map((r: any) => ({ ...r, type: "out" })),
    ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    const price = parseFloat(product.price) || 0;
    const unitName = helpers.getProductUnit(product.id);
    const categoryName = helpers.getCategoryName(product.category_id);

    let openingBalance = parseInt(product.stock) || 0;
    const totalIn = pIn.reduce((s: number, r: any) => s + (parseInt(r.quantity) || 0), 0);
    const totalOut = pOut.reduce((s: number, r: any) => s + (parseInt(r.quantity) || 0), 0);
    openingBalance = openingBalance - totalIn + totalOut;

    const openingMonth = dateFrom ? dateFrom.toLocaleDateString("th-TH", { month: "long", year: "numeric" }) : "";

    let balance = openingBalance;
    const rows = movements.map((m: any) => {
      const qty = parseInt(m.quantity) || 0;
      if (m.type === "in") balance += qty; else balance -= qty;
      const ref = m.type === "in" ? m.invoice_no : m.requisition_no;
      const party = m.type === "in" ? helpers.getCompanyName(m.company_id) : helpers.getDepartmentName(m.department_id);
      return {
        date: m.date,
        party,
        ref,
        price,
        inQty: m.type === "in" ? qty : null,
        outQty: m.type === "out" ? qty : null,
        balance,
        totalPrice: balance * price,
      };
    });

    return {
      sheetNo: String(pIdx + 1).padStart(3, "0"),
      productId: product.id,
      productName: product.name,
      categoryName,
      unitName,
      minStock: product.min_stock || "-",
      price,
      openingBalance,
      openingMonth,
      rows,
    };
  });
}

export async function exportStockCardToExcel(params: StockCardExportParams): Promise<boolean> {
  const wb = XLSX.utils.book_new();
  const productsData = buildStockCardProductData(params);

  productsData.forEach(pd => {
    const wsData: any[][] = [];
    wsData.push(["", "", "", "บัญชีวัสดุ", "", "", "", "", ""]);
    wsData.push([]);
    wsData.push(["แผ่นที่", `: ${pd.sheetNo}`, "", "", "ส่วนราชการ", ": -"]);
    wsData.push(["ประเภท", `: ${pd.categoryName}`, "", "", "กลุ่มงาน", ": -"]);
    wsData.push(["ชื่อหรือชนิดวัสดุ", `: ${pd.productName}`, "", "", "หน่วยงาน", ": -"]);
    wsData.push(["ขนาดหรือลักษณะ", ": -", "", "", "รหัส", `: ${pd.productId}`]);
    wsData.push(["หน่วยนับ", `: ${pd.unitName}`, "", "", "จำนวนอย่างสูง", ": -"]);
    wsData.push(["", "", "", "", "จำนวนอย่างต่ำ", `: ${pd.minStock}`]);
    wsData.push([]);
    // Table header
    wsData.push(["วัน เดือน ปี", "รับจาก/จ่ายให้", "เลขที่เอกสาร", "ราคาต่อหน่วย (บาท)", "รับ", "จ่าย", "คงเหลือ", "ราคารวม", "หมายเหตุ"]);
    // Opening balance
    wsData.push([
      "", `ยอดยกมา${pd.openingMonth ? `เดือน${pd.openingMonth}` : ""}`, "",
      pd.price || "", "-", "-", pd.openingBalance,
      pd.openingBalance * pd.price, ""
    ]);
    // Movement rows
    pd.rows.forEach(r => {
      wsData.push([
        r.date, r.party, r.ref, r.price,
        r.inQty !== null ? r.inQty : "-",
        r.outQty !== null ? r.outQty : "-",
        r.balance, r.totalPrice, ""
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 18 },
      { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 12 }
    ];
    const sheetName = `${pd.productId}-${pd.productName}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["ไม่พบข้อมูล"]]);
    XLSX.utils.book_append_sheet(wb, ws, "รายงาน");
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return saveFile(blob, "รายงานสต็อกการ์ด.xlsx");
}

export async function exportStockCardToPDF(params: StockCardExportParams): Promise<boolean> {
  const doc = new jsPDF({ orientation: "landscape" });
  const hasThai = await loadThaiFont(doc);
  const fontOpt = hasThai ? { font: "Sarabun" } : {};

  const productsData = buildStockCardProductData(params);

  productsData.forEach((pd, idx) => {
    if (idx > 0) doc.addPage();

    doc.setFontSize(16);
    doc.text("บัญชีวัสดุ", doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });

    doc.setFontSize(10);
    const lx = 14;
    const rx = 160;
    let y = 25;
    doc.text(`แผ่นที่ : ${pd.sheetNo}`, lx, y);
    doc.text(`ส่วนราชการ : -`, rx, y);
    y += 6;
    doc.text(`ประเภท : ${pd.categoryName}`, lx, y);
    doc.text(`กลุ่มงาน : -`, rx, y);
    y += 6;
    doc.text(`ชื่อหรือชนิดวัสดุ : ${pd.productName}`, lx, y);
    doc.text(`หน่วยงาน : -`, rx, y);
    y += 6;
    doc.text(`ขนาดหรือลักษณะ : -`, lx, y);
    doc.text(`รหัส : ${pd.productId}`, rx, y);
    y += 6;
    doc.text(`หน่วยนับ : ${pd.unitName}`, lx, y);
    doc.text(`จำนวนอย่างสูง : -`, rx, y);
    y += 6;
    doc.text(`จำนวนอย่างต่ำ : ${pd.minStock}`, rx, y);
    y += 4;

    const tableBody: string[][] = [];
    // Opening balance row
    tableBody.push([
      "", `ยอดยกมา${pd.openingMonth ? `เดือน${pd.openingMonth}` : ""}`, "",
      pd.price ? pd.price.toLocaleString() : "", "-", "-",
      pd.openingBalance.toLocaleString(),
      (pd.openingBalance * pd.price).toLocaleString(), ""
    ]);
    // Movement rows
    pd.rows.forEach(r => {
      tableBody.push([
        r.date, r.party, r.ref,
        r.price ? r.price.toLocaleString() : "",
        r.inQty !== null ? r.inQty.toLocaleString() : "-",
        r.outQty !== null ? r.outQty.toLocaleString() : "-",
        r.balance.toLocaleString(),
        r.totalPrice.toLocaleString(), ""
      ]);
    });

    autoTable(doc, {
      head: [["วัน เดือน ปี", "รับจาก/จ่ายให้", "เลขที่เอกสาร", "ราคาต่อหน่วย\nบาท", "รับ", "จ่าย", "คงเหลือ", "ราคารวม", "หมายเหตุ"]],
      body: tableBody,
      startY: y,
      styles: { fontSize: 9, ...fontOpt },
      headStyles: { fillColor: [59, 130, 246], halign: "center" },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 45 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25, halign: "right" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 22, halign: "right" },
        7: { cellWidth: 28, halign: "right" },
        8: { cellWidth: 25 },
      },
    });
  });

  if (productsData.length === 0) {
    doc.setFontSize(14);
    doc.text("ไม่พบข้อมูล", 14, 20);
  }

  const blob = doc.output("blob");
  return saveFile(blob, "รายงานสต็อกการ์ด.pdf");
}

// Build ExportData from the current report context
export function buildReportData(
  reportType: string,
  products: any[],
  stockIn: any[],
  stockOut: any[],
  helpers: {
    getProductName: (id: string) => string;
    getProductUnit: (id: string) => string;
    getCategoryName: (id: string) => string;
    getCompanyName: (id: string) => string;
    getDepartmentName: (id: string) => string;
  }
): ExportData {
  const { getProductName, getProductUnit, getCategoryName, getCompanyName, getDepartmentName } = helpers;

  switch (reportType) {
    case "daily":
    case "monthly":
    case "product-movement": {
      const allMovements = [
        ...stockIn.map(r => ({ ...r, type: "in", ref: r.invoice_no, party: getCompanyName(r.company_id) })),
        ...stockOut.map(r => ({ ...r, type: "out", ref: r.requisition_no, party: getDepartmentName(r.department_id) })),
      ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return {
        title: reportType === "daily" ? "รายงานประจำวัน" : reportType === "monthly" ? "รายงานประจำเดือน" : "รายงานการรับ-จ่าย",
        headers: ["วันที่", "ประเภท", "เลขที่เอกสาร", "สินค้า", "หน่วย", "จำนวน", "จาก/ไปยัง"],
        rows: allMovements.map(m => [
          m.date, m.type === "in" ? "รับเข้า" : "เบิกออก", m.ref,
          getProductName(m.product_id), getProductUnit(m.product_id),
          (m.type === "in" ? "+" : "-") + (parseInt(m.quantity) || 0), m.party,
        ]),
      };
    }
    case "stock-balance": {
      return {
        title: "รายงานสินค้าคงคลัง",
        headers: ["รหัส", "ชื่อสินค้า", "ประเภท", "หน่วย", "ราคา", "คงเหลือ", "มูลค่า"],
        rows: products.map(p => {
          const stock = parseInt(p.stock) || 0;
          const price = parseFloat(p.price) || 0;
          return [p.id, p.name, getCategoryName(p.category_id), getProductUnit(p.id), price, stock, stock * price];
        }),
      };
    }
    case "stock-card": {
      const headers = ["สินค้า", "วันที่", "รายการ", "รับเข้า", "เบิกออก", "คงเหลือ"];
      const rows: (string | number)[][] = [];
      products.forEach(product => {
        const pIn = stockIn.filter(r => r.product_id === product.id).map(r => ({ ...r, type: "in" }));
        const pOut = stockOut.filter(r => r.product_id === product.id).map(r => ({ ...r, type: "out" }));
        const movements = [...pIn, ...pOut].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        let balance = 0;
        movements.forEach(m => {
          const qty = parseInt(m.quantity) || 0;
          if (m.type === "in") balance += qty; else balance -= qty;
          rows.push([
            `${product.id} - ${product.name}`, m.date,
            m.type === "in" ? `รับจาก ${getCompanyName(m.company_id)}` : `เบิกไป ${getDepartmentName(m.department_id)}`,
            m.type === "in" ? qty : "", m.type === "out" ? qty : "", balance,
          ]);
        });
      });
      return { title: "รายงานสต็อกการ์ด", headers, rows };
    }
    case "by-company": {
      const rows: (string | number)[][] = [];
      const companyIds = [...new Set(stockIn.map(r => r.company_id))];
      companyIds.forEach(cid => {
        stockIn.filter(r => r.company_id === cid).forEach(r => {
          rows.push([getCompanyName(cid), r.date, r.invoice_no, getProductName(r.product_id), getProductUnit(r.product_id), parseInt(r.quantity) || 0]);
        });
      });
      return { title: "รับสินค้าแยกตามบริษัท", headers: ["บริษัท", "วันที่", "เลขที่ใบส่งของ", "สินค้า", "หน่วย", "จำนวน"], rows };
    }
    case "by-department": {
      const rows: (string | number)[][] = [];
      const deptIds = [...new Set(stockOut.map(r => r.department_id))];
      deptIds.forEach(did => {
        stockOut.filter(r => r.department_id === did).forEach(r => {
          rows.push([getDepartmentName(did), r.date, r.requisition_no, getProductName(r.product_id), getProductUnit(r.product_id), parseInt(r.quantity) || 0]);
        });
      });
      return { title: "เบิกสินค้าแยกตามหน่วยงาน", headers: ["หน่วยงาน", "วันที่", "เลขที่ใบเบิก", "สินค้า", "หน่วย", "จำนวน"], rows };
    }
    case "stock-in-history":
      return {
        title: "ประวัติการรับเข้า",
        headers: ["รหัส", "วันที่", "เลขที่ใบส่งของ", "สินค้า", "หน่วย", "จำนวน", "จากบริษัท"],
        rows: stockIn.map(r => [r.id, r.date, r.invoice_no, getProductName(r.product_id), getProductUnit(r.product_id), parseInt(r.quantity) || 0, getCompanyName(r.company_id)]),
      };
    case "stock-out-history":
      return {
        title: "ประวัติการเบิกจ่าย",
        headers: ["รหัส", "วันที่", "เลขที่ใบเบิก", "สินค้า", "หน่วย", "จำนวน", "หน่วยงาน"],
        rows: stockOut.map(r => [r.id, r.date, r.requisition_no, getProductName(r.product_id), getProductUnit(r.product_id), parseInt(r.quantity) || 0, getDepartmentName(r.department_id)]),
      };
    case "low-stock": {
      const lowStock = products.filter(p => {
        const stock = parseInt(p.stock) || 0;
        const minStock = parseInt(p.min_stock) || 0;
        return minStock > 0 && stock < minStock;
      });
      return {
        title: "สินค้าต่ำกว่าเกณฑ์",
        headers: ["รหัส", "ชื่อสินค้า", "ประเภท", "หน่วย", "คงเหลือ", "เกณฑ์ขั้นต่ำ", "ขาดอีก"],
        rows: lowStock.map(p => {
          const stock = parseInt(p.stock) || 0;
          const minStock = parseInt(p.min_stock) || 0;
          return [p.id, p.name, getCategoryName(p.category_id), getProductUnit(p.id), stock, minStock, minStock - stock];
        }),
      };
    }
    default:
      return { title: "รายงาน", headers: [], rows: [] };
  }
}
