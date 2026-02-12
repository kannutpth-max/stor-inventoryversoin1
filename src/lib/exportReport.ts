import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

async function saveFile(blob: Blob, defaultName: string) {
  // Use File System Access API to let user pick save location
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
      if (e.name === "AbortError") return false; // user cancelled
    }
  }
  // Fallback: standard download
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

  // Use default font (Helvetica) — Thai text may not render perfectly but avoids font issues
  doc.setFontSize(16);
  doc.text(data.title, 14, 20);

  autoTable(doc, {
    head: [data.headers],
    body: data.rows.map(r => r.map(c => String(c))),
    startY: 30,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const blob = doc.output("blob");
  return saveFile(blob, `${data.title}.pdf`);
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
