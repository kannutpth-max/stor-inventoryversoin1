import { Loader2, FileText } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSheetData } from "@/hooks/useGoogleSheets";
import { format, parseISO, isSameDay, isSameMonth } from "date-fns";
import { th } from "date-fns/locale";

interface Product { id: string; name: string; category_id: string; unit_id: string; price: string; min_stock: string; stock: string; }
interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }
interface Company { id: string; name: string; contact: string; address: string; }
interface Department { id: string; name: string; }
interface StockInRecord { id: string; date: string; invoice_no: string; company_id: string; product_id: string; quantity: string; created_at: string; }
interface StockOutRecord { id: string; date: string; requisition_no: string; department_id: string; product_id: string; quantity: string; created_at: string; }

interface ReportPreviewProps {
  reportType: string;
  dateFrom?: Date;
  dateTo?: Date;
  productFrom: string;
  productTo: string;
  selectedCompany?: string;
  selectedDepartment?: string;
  selectedCategory?: string;
}

export default function ReportPreview({ reportType, dateFrom, dateTo, productFrom, productTo, selectedCompany, selectedDepartment, selectedCategory }: ReportPreviewProps) {
  const { data: products = [], isLoading: loadingProducts } = useSheetData<Product>("products");
  const { data: categories = [] } = useSheetData<Category>("categories");
  const { data: units = [] } = useSheetData<Unit>("units");
  const { data: companies = [] } = useSheetData<Company>("companies");
  const { data: departments = [] } = useSheetData<Department>("departments");
  const { data: stockIn = [], isLoading: loadingSI } = useSheetData<StockInRecord>("stock_in");
  const { data: stockOut = [], isLoading: loadingSO } = useSheetData<StockOutRecord>("stock_out");

  const isLoading = loadingProducts || loadingSI || loadingSO;

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;
  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || id;
  const getUnitName = (unitId: string) => {
    const product = products.find(p => p.id === unitId);
    if (product) return units.find(u => u.id === product.unit_id)?.name || product.unit_id;
    return units.find(u => u.id === unitId)?.name || unitId;
  };
  const getProductUnit = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product ? (units.find(u => u.id === product.unit_id)?.name || product.unit_id) : "";
  };
  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || id;
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || id;

  const filterByDate = (dateStr: string) => {
    if (!dateStr) return true;
    try {
      const d = parseISO(dateStr);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    } catch { return true; }
  };

  const sortedProductIds = [...products].map(p => p.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const fromIdx = productFrom ? sortedProductIds.indexOf(productFrom) : -1;
  const toIdx = productTo ? sortedProductIds.indexOf(productTo) : -1;
  const lowerIdx = fromIdx >= 0 ? fromIdx : 0;
  const upperIdx = toIdx >= 0 ? toIdx : sortedProductIds.length - 1;
  const allowedIds = new Set(sortedProductIds.slice(Math.min(lowerIdx, upperIdx), Math.max(lowerIdx, upperIdx) + 1));

  const filterByProduct = (productId: string) => {
    if (!productFrom && !productTo) return true;
    return allowedIds.has(productId);
  };

  const filteredStockIn = stockIn.filter(r => filterByDate(r.date) && filterByProduct(r.product_id) && (!selectedCompany || r.company_id === selectedCompany));
  const filteredStockOut = stockOut.filter(r => filterByDate(r.date) && filterByProduct(r.product_id) && (!selectedDepartment || r.department_id === selectedDepartment));
  const filteredProducts = products.filter(p => filterByProduct(p.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  switch (reportType) {
    case "daily":
    case "monthly":
      return <DailyMonthlyReport stockIn={filteredStockIn} stockOut={filteredStockOut} getProductName={getProductName} getProductUnit={getProductUnit} getCompanyName={getCompanyName} getDepartmentName={getDepartmentName} />;
    case "stock-balance":
      return <StockBalanceReport products={filteredProducts} stockIn={filteredStockIn} stockOut={filteredStockOut} getProductUnit={getProductUnit} dateFrom={dateFrom} dateTo={dateTo} />;
    case "stock-card":
      return <StockCardReport products={filteredProducts} stockIn={filteredStockIn} stockOut={filteredStockOut} getProductUnit={getProductUnit} getCompanyName={getCompanyName} getDepartmentName={getDepartmentName} getCategoryName={getCategoryName} dateFrom={dateFrom} />;
    case "product-movement":
      return <DailyMonthlyReport stockIn={filteredStockIn} stockOut={filteredStockOut} getProductName={getProductName} getProductUnit={getProductUnit} getCompanyName={getCompanyName} getDepartmentName={getDepartmentName} />;
    case "by-company":
      return <ByCompanyReport stockIn={filteredStockIn} companies={companies} getProductName={getProductName} getProductUnit={getProductUnit} />;
    case "by-department":
      return <ByDepartmentReport stockOut={filteredStockOut} departments={departments} getProductName={getProductName} getProductUnit={getProductUnit} />;
    case "stock-in-history":
      return <StockInHistoryReport stockIn={filteredStockIn} getProductName={getProductName} getProductUnit={getProductUnit} getCompanyName={getCompanyName} />;
    case "stock-out-history":
      return <StockOutHistoryReport stockOut={filteredStockOut} getProductName={getProductName} getProductUnit={getProductUnit} getDepartmentName={getDepartmentName} />;
    case "low-stock":
      return <LowStockReport products={filteredProducts} getCategoryName={getCategoryName} getProductUnit={(pid) => getProductUnit(pid)} />;
    default:
      return <EmptyReport />;
  }
}

function EmptyReport() {
  return (
    <div className="text-center text-muted-foreground py-8">
      <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
      <p>ไม่พบข้อมูลรายงาน</p>
    </div>
  );
}

function NoData() {
  return (
    <TableRow>
      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">ไม่พบข้อมูล</TableCell>
    </TableRow>
  );
}

// ======================== Report Components ========================

function DailyMonthlyReport({ stockIn, stockOut, getProductName, getProductUnit, getCompanyName, getDepartmentName }: {
  stockIn: StockInRecord[]; stockOut: StockOutRecord[];
  getProductName: (id: string) => string; getProductUnit: (id: string) => string;
  getCompanyName: (id: string) => string; getDepartmentName: (id: string) => string;
}) {
  const allMovements = [
    ...stockIn.map(r => ({ ...r, type: "in" as const, ref: r.invoice_no, party: getCompanyName(r.company_id) })),
    ...stockOut.map(r => ({ ...r, type: "out" as const, ref: r.requisition_no, party: getDepartmentName(r.department_id) })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>วันที่</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>เลขที่เอกสาร</TableHead>
            <TableHead>วัสดุ</TableHead>
            <TableHead>หน่วย</TableHead>
            <TableHead className="text-right">จำนวน</TableHead>
            <TableHead>จาก/ไปยัง</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allMovements.length === 0 ? <NoData /> : allMovements.map((m, i) => (
            <TableRow key={i}>
              <TableCell>{m.date}</TableCell>
              <TableCell>
                <Badge variant={m.type === "in" ? "default" : "secondary"} className={m.type === "in" ? "bg-success/10 text-success border-success/20" : "bg-accent/10 text-accent border-accent/20"}>
                  {m.type === "in" ? "รับเข้า" : "เบิกออก"}
                </Badge>
              </TableCell>
              <TableCell>{m.ref}</TableCell>
              <TableCell>{getProductName(m.product_id)}</TableCell>
              <TableCell>{getProductUnit(m.product_id)}</TableCell>
              <TableCell className={`text-right font-medium ${m.type === "in" ? "text-success" : "text-destructive"}`}>
                {m.type === "in" ? "+" : "-"}{parseInt(m.quantity).toLocaleString()}
              </TableCell>
              <TableCell>{m.party}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {allMovements.length > 0 && (
        <div className="p-4 border-t bg-muted/30 flex gap-6 text-sm">
          <span>รวมรับเข้า: <strong className="text-success">{stockIn.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0).toLocaleString()}</strong></span>
          <span>รวมเบิกออก: <strong className="text-destructive">{stockOut.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0).toLocaleString()}</strong></span>
        </div>
      )}
    </div>
  );
}

// Helper: aggregate stock-balance per product
export function computeStockBalanceRows(
  products: Product[],
  stockIn: StockInRecord[],
  stockOut: StockOutRecord[],
  getProductUnit: (id: string) => string,
) {
  return products.map((p, idx) => {
    const price = parseFloat(p.price) || 0;
    const pIn = stockIn.filter(r => r.product_id === p.id);
    const pOut = stockOut.filter(r => r.product_id === p.id);
    const inQty = pIn.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0);
    const outQty = pOut.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0);
    const currentStock = parseInt(p.stock) || 0;
    const opening = currentStock - inQty + outQty;
    const closing = opening + inQty - outQty;
    return {
      seq: idx + 1,
      id: p.id,
      name: p.name,
      unit: getProductUnit(p.id),
      opening,
      price,
      openingValue: opening * price,
      inPrice: price,
      inQty,
      inValue: inQty * price,
      outPrice: price,
      outQty,
      outValue: outQty * price,
      closing,
      closingValue: closing * price,
    };
  });
}

function StockBalanceReport({ products, stockIn, stockOut, getProductUnit, dateFrom, dateTo }: {
  products: Product[]; stockIn: StockInRecord[]; stockOut: StockOutRecord[];
  getProductUnit: (id: string) => string; dateFrom?: Date; dateTo?: Date;
}) {
  const rows = computeStockBalanceRows(products, stockIn, stockOut, getProductUnit);
  const refDate = dateTo || dateFrom || new Date();
  const monthLabel = format(refDate, "MMMM", { locale: th });
  const yearBE = refDate.getFullYear() + 543;
  const openDate = dateFrom ? `${format(dateFrom, "d", { locale: th })} ${format(dateFrom, "MMM", { locale: th })} ${dateFrom.getFullYear() + 543}` : "-";
  const closeDate = dateTo ? `${format(dateTo, "d", { locale: th })} ${format(dateTo, "MMM", { locale: th })} ${dateTo.getFullYear() + 543}` : "-";

  const totals = rows.reduce((acc, r) => {
    acc.openingValue += r.openingValue;
    acc.inValue += r.inValue;
    acc.outValue += r.outValue;
    acc.closingValue += r.closingValue;
    return acc;
  }, { openingValue: 0, inValue: 0, outValue: 0, closingValue: 0 });

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => n.toLocaleString();

  return (
    <div className="rounded-md border bg-card overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead rowSpan={2} className="border text-center align-middle">ลำดับ</TableHead>
            <TableHead rowSpan={2} className="border text-center align-middle">รายการ</TableHead>
            <TableHead rowSpan={2} className="border text-center align-middle">หน่วย<br/>นับ</TableHead>
            <TableHead rowSpan={2} className="border text-center align-middle">จำนวน<br/>คงเหลือ<br/>ยกมา</TableHead>
            <TableHead rowSpan={2} className="border text-center align-middle">ราคา/<br/>หน่วย</TableHead>
            <TableHead rowSpan={2} className="border text-center align-middle">รวมยอดที่ซื้อ<br/>จำนวนเงิน<br/>ยกมา</TableHead>
            <TableHead colSpan={6} className="border text-center">ยอดคงคลัง เดือน {monthLabel} {yearBE}</TableHead>
            <TableHead colSpan={2} className="border text-center">คงเหลือ</TableHead>
          </TableRow>
          <TableRow className="bg-muted/50">
            <TableHead colSpan={3} className="border text-center">รับมา</TableHead>
            <TableHead colSpan={3} className="border text-center">ใช้ไป</TableHead>
            <TableHead className="border text-center">หน่วย</TableHead>
            <TableHead className="border text-center">จำนวนเงิน</TableHead>
          </TableRow>
          <TableRow className="bg-muted/30">
            <TableHead className="border" colSpan={6}></TableHead>
            <TableHead className="border text-center">ราคา/หน่วย</TableHead>
            <TableHead className="border text-center">หน่วย</TableHead>
            <TableHead className="border text-center">จำนวนเงิน</TableHead>
            <TableHead className="border text-center">ราคา/หน่วย</TableHead>
            <TableHead className="border text-center">หน่วย</TableHead>
            <TableHead className="border text-center">จำนวนเงิน</TableHead>
            <TableHead className="border" colSpan={2}></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-6">ไม่พบข้อมูล</TableCell></TableRow>
          ) : rows.map(r => (
            <TableRow key={r.id}>
              <TableCell className="border text-center">{r.seq}</TableCell>
              <TableCell className="border">{r.name}</TableCell>
              <TableCell className="border text-center">{r.unit}</TableCell>
              <TableCell className="border text-center">{fmtInt(r.opening)}</TableCell>
              <TableCell className="border text-right">{fmt(r.price)}</TableCell>
              <TableCell className="border text-right">{r.openingValue ? fmt(r.openingValue) : "-"}</TableCell>
              <TableCell className="border text-right">{r.inQty ? fmt(r.inPrice) : "-"}</TableCell>
              <TableCell className="border text-center">{r.inQty}</TableCell>
              <TableCell className="border text-right">{r.inQty ? fmt(r.inValue) : "-"}</TableCell>
              <TableCell className="border text-right">{r.outQty ? fmt(r.outPrice) : "-"}</TableCell>
              <TableCell className="border text-center">{r.outQty}</TableCell>
              <TableCell className="border text-right">{r.outQty ? fmt(r.outValue) : "-"}</TableCell>
              <TableCell className="border text-center">{fmtInt(r.closing)}</TableCell>
              <TableCell className="border text-right">{r.closingValue ? fmt(r.closingValue) : "-"}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className="bg-muted/40 font-semibold">
              <TableCell className="border" colSpan={5}>สรุปยอดคงคลังวัสดุงานบ้านงานครัว ประจำเดือน {monthLabel} {yearBE}</TableCell>
              <TableCell className="border text-right">ยกมา {fmt(totals.openingValue)}</TableCell>
              <TableCell className="border" colSpan={2}>รวม</TableCell>
              <TableCell className="border text-right">{fmt(totals.inValue)}</TableCell>
              <TableCell className="border" colSpan={2}></TableCell>
              <TableCell className="border text-right">{fmt(totals.outValue)}</TableCell>
              <TableCell className="border"></TableCell>
              <TableCell className="border text-right">{fmt(totals.closingValue)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Summary block */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 text-sm border-t">
          <div className="space-y-1">
            <div className="font-semibold underline">สรุปยอดคงคลังวัสดุงานบ้านงานครัว ประจำเดือน {monthLabel} {yearBE}</div>
            <div className="grid grid-cols-[140px,160px,1fr] gap-x-2">
              <span>ยอดยกมา ณ วันที่</span><span>{openDate}</span><span className="text-right pr-4">{fmt(totals.openingValue)}</span>
              <span className="underline">ยอดรับเข้า</span><span></span><span className="text-right pr-4">{fmt(totals.inValue)}</span>
              <span className="underline">ยอดใช้ไป</span><span></span><span className="text-right pr-4">{fmt(totals.outValue)}</span>
              <span>ยอดคงเหลือ ณ วันที่</span><span>{closeDate}</span><span className="text-right pr-4 font-bold">{fmt(totals.closingValue)}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div>ลงชื่อ......................................ผู้จัดทำรายงาน</div>
              <div className="pl-12">(.................................)</div>
              <div className="pl-12">ตำแหน่ง..............................</div>
            </div>
            <div>
              <div>ลงชื่อ......................................เจ้าหน้าที่</div>
              <div className="pl-12">(.................................)</div>
              <div className="pl-12">ตำแหน่ง..............................</div>
            </div>
          </div>

          <div className="space-y-2">
            <div>ลงชื่อ......................................หัวหน้าเจ้าหน้าที่</div>
            <div className="pl-12">(.................................)</div>
            <div className="pl-12">ตำแหน่ง..............................</div>
          </div>
          <div className="space-y-2">
            <div>ลงชื่อ......................................</div>
            <div className="pl-12">(.................................)</div>
            <div className="pl-12">ผู้อำนวยการ</div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockCardReport({ products, stockIn, stockOut, getProductUnit, getCompanyName, getDepartmentName, getCategoryName, dateFrom }: {
  products: Product[]; stockIn: StockInRecord[]; stockOut: StockOutRecord[];
  getProductUnit: (id: string) => string; getCompanyName: (id: string) => string; getDepartmentName: (id: string) => string;
  getCategoryName: (id: string) => string; dateFrom?: Date;
}) {
  const formatThaiDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return format(d, "d MMM yy", { locale: th });
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-8">
      {products.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">ไม่พบข้อมูล</div>
      ) : products.map((product, pIdx) => {
        const pIn = stockIn.filter(r => r.product_id === product.id).map(r => ({ ...r, type: "in" as const }));
        const pOut = stockOut.filter(r => r.product_id === product.id).map(r => ({ ...r, type: "out" as const }));
        const movements = [...pIn, ...pOut].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        if (movements.length === 0 && pIn.length === 0 && pOut.length === 0) return null;

        const price = parseFloat(product.price) || 0;
        const unitName = getProductUnit(product.id);
        const categoryName = getCategoryName(product.category_id);

        // Calculate opening balance (stock before the filtered period)
        let openingBalance = parseInt(product.stock) || 0;
        // Subtract all filtered movements to get the starting balance
        const totalIn = pIn.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0);
        const totalOut = pOut.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0);
        openingBalance = openingBalance - totalIn + totalOut;

        let balance = openingBalance;
        const rows = movements.map(m => {
          const qty = parseInt(m.quantity) || 0;
          if (m.type === "in") balance += qty; else balance -= qty;
          return { ...m, qty, balance, totalPrice: balance * price };
        });

        const openingMonth = dateFrom ? format(dateFrom, "MMMM yyyy", { locale: th }) : "";

        return (
          <div key={product.id} className="rounded-md border bg-card print:break-before-page">
            {/* Header - บัญชีวัสดุ */}
            <div className="text-center py-3 border-b">
              <h2 className="text-lg font-bold">บัญชีวัสดุ</h2>
            </div>

            {/* Product Info Header */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 p-4 border-b text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">แผ่นที่</span>
                <span>: {String(pIdx + 1).padStart(3, "0")}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">ส่วนราชการ</span>
                <span>: -</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">ประเภท</span>
                <span>: {categoryName}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">กลุ่มงาน</span>
                <span>: -</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">ชื่อหรือชนิดวัสดุ</span>
                <span>: {product.name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">หน่วยงาน</span>
                <span>: -</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">ขนาดหรือลักษณะ</span>
                <span>: -</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">รหัส</span>
                <span>: {product.id}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">หน่วยนับ</span>
                <span>: {unitName}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">จำนวนอย่างสูง</span>
                <span>: -</span>
              </div>
              <div></div>
              <div className="flex gap-2">
                <span className="text-muted-foreground min-w-[100px]">จำนวนอย่างต่ำ</span>
                <span>: {product.min_stock || "-"}</span>
              </div>
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead rowSpan={2} className="border-r text-center align-middle">วัน เดือน ปี</TableHead>
                  <TableHead rowSpan={2} className="border-r text-center align-middle">รับจาก/จ่ายให้</TableHead>
                  <TableHead rowSpan={2} className="border-r text-center align-middle">เลขที่เอกสาร</TableHead>
                  <TableHead rowSpan={2} className="border-r text-center align-middle">ราคาต่อหน่วย<br/>บาท</TableHead>
                  <TableHead colSpan={3} className="border-r text-center border-b">จำนวน</TableHead>
                  <TableHead rowSpan={2} className="border-r text-center align-middle">ราคารวม</TableHead>
                  <TableHead rowSpan={2} className="text-center align-middle">หมายเหตุ</TableHead>
                </TableRow>
                <TableRow className="bg-muted/50">
                  <TableHead className="border-r text-center">รับ</TableHead>
                  <TableHead className="border-r text-center">จ่าย</TableHead>
                  <TableHead className="border-r text-center">คงเหลือ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening balance row */}
                <TableRow className="bg-muted/20">
                  <TableCell className="border-r text-center"></TableCell>
                  <TableCell className="border-r font-medium">
                    ยอดยกมา{openingMonth ? `เดือน${openingMonth}` : ""}
                  </TableCell>
                  <TableCell className="border-r"></TableCell>
                  <TableCell className="border-r text-right">{price > 0 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</TableCell>
                  <TableCell className="border-r text-center">-</TableCell>
                  <TableCell className="border-r text-center">-</TableCell>
                  <TableCell className="border-r text-center font-medium">{openingBalance.toLocaleString()}</TableCell>
                  <TableCell className="border-r text-right font-medium">{(openingBalance * price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-4">ไม่มีรายการเคลื่อนไหว</TableCell></TableRow>
                ) : rows.map((r, i) => {
                  const docNo = r.type === "in" ? (r as any).invoice_no : (r as any).requisition_no;
                  const party = r.type === "in" ? getCompanyName((r as any).company_id) : getDepartmentName((r as any).department_id);
                  return (
                    <TableRow key={i}>
                      <TableCell className="border-r text-center">{formatThaiDate(r.date)}</TableCell>
                      <TableCell className="border-r">{party}</TableCell>
                      <TableCell className="border-r text-center">{docNo}</TableCell>
                      <TableCell className="border-r text-right">{price > 0 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</TableCell>
                      <TableCell className="border-r text-center">{r.type === "in" ? r.qty.toLocaleString() : "-"}</TableCell>
                      <TableCell className="border-r text-center">{r.type === "out" ? r.qty.toLocaleString() : "-"}</TableCell>
                      <TableCell className="border-r text-center font-medium">{r.balance.toLocaleString()}</TableCell>
                      <TableCell className="border-r text-right">{r.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}

function ByCompanyReport({ stockIn, companies, getProductName, getProductUnit }: {
  stockIn: StockInRecord[]; companies: Company[]; getProductName: (id: string) => string; getProductUnit: (id: string) => string;
}) {
  return (
    <div className="space-y-6">
      {companies.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">ไม่พบข้อมูล</div>
      ) : companies.map(company => {
        const records = stockIn.filter(r => r.company_id === company.id);
        if (records.length === 0) return null;
        return (
          <div key={company.id} className="rounded-md border">
            <div className="p-3 bg-muted/50 border-b font-medium">{company.name}</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>เลขที่ใบส่งของ</TableHead>
                  <TableHead>วัสดุ</TableHead>
                  <TableHead>หน่วย</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.invoice_no}</TableCell>
                    <TableCell>{getProductName(r.product_id)}</TableCell>
                    <TableCell>{getProductUnit(r.product_id)}</TableCell>
                    <TableCell className="text-right">{parseInt(r.quantity).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-3 border-t bg-muted/30 text-sm">
              รวม: <strong>{records.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0).toLocaleString()}</strong> รายการ
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ByDepartmentReport({ stockOut, departments, getProductName, getProductUnit }: {
  stockOut: StockOutRecord[]; departments: Department[]; getProductName: (id: string) => string; getProductUnit: (id: string) => string;
}) {
  return (
    <div className="space-y-6">
      {departments.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">ไม่พบข้อมูล</div>
      ) : departments.map(dept => {
        const records = stockOut.filter(r => r.department_id === dept.id);
        if (records.length === 0) return null;
        return (
          <div key={dept.id} className="rounded-md border">
            <div className="p-3 bg-muted/50 border-b font-medium">{dept.name}</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>เลขที่ใบเบิก</TableHead>
                  <TableHead>วัสดุ</TableHead>
                  <TableHead>หน่วย</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.requisition_no}</TableCell>
                    <TableCell>{getProductName(r.product_id)}</TableCell>
                    <TableCell>{getProductUnit(r.product_id)}</TableCell>
                    <TableCell className="text-right">{parseInt(r.quantity).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-3 border-t bg-muted/30 text-sm">
              รวม: <strong>{records.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0).toLocaleString()}</strong> รายการ
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StockInHistoryReport({ stockIn, getProductName, getProductUnit, getCompanyName }: {
  stockIn: StockInRecord[]; getProductName: (id: string) => string; getProductUnit: (id: string) => string; getCompanyName: (id: string) => string;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>รหัส</TableHead>
            <TableHead>วันที่</TableHead>
            <TableHead>เลขที่ใบส่งของ</TableHead>
            <TableHead>วัสดุ</TableHead>
            <TableHead>หน่วย</TableHead>
            <TableHead className="text-right">จำนวน</TableHead>
            <TableHead>จากบริษัท</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockIn.length === 0 ? <NoData /> : stockIn.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{r.id}</TableCell>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.invoice_no}</TableCell>
              <TableCell>{getProductName(r.product_id)}</TableCell>
              <TableCell>{getProductUnit(r.product_id)}</TableCell>
              <TableCell className="text-right text-success">+{parseInt(r.quantity).toLocaleString()}</TableCell>
              <TableCell>{getCompanyName(r.company_id)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StockOutHistoryReport({ stockOut, getProductName, getProductUnit, getDepartmentName }: {
  stockOut: StockOutRecord[]; getProductName: (id: string) => string; getProductUnit: (id: string) => string; getDepartmentName: (id: string) => string;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>รหัส</TableHead>
            <TableHead>วันที่</TableHead>
            <TableHead>เลขที่ใบเบิก</TableHead>
            <TableHead>วัสดุ</TableHead>
            <TableHead>หน่วย</TableHead>
            <TableHead className="text-right">จำนวน</TableHead>
            <TableHead>หน่วยงาน</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockOut.length === 0 ? <NoData /> : stockOut.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{r.id}</TableCell>
              <TableCell>{r.date}</TableCell>
              <TableCell>{r.requisition_no}</TableCell>
              <TableCell>{getProductName(r.product_id)}</TableCell>
              <TableCell>{getProductUnit(r.product_id)}</TableCell>
              <TableCell className="text-right text-destructive">-{parseInt(r.quantity).toLocaleString()}</TableCell>
              <TableCell>{getDepartmentName(r.department_id)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LowStockReport({ products, getCategoryName, getProductUnit }: {
  products: Product[]; getCategoryName: (id: string) => string; getProductUnit: (pid: string) => string;
}) {
  const lowStockProducts = products.filter(p => {
    const stock = parseInt(p.stock) || 0;
    const minStock = parseInt(p.min_stock) || 0;
    return minStock > 0 && stock < minStock;
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>รหัส</TableHead>
            <TableHead>ชื่อวัสดุ</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>หน่วย</TableHead>
            <TableHead className="text-right">คงเหลือ</TableHead>
            <TableHead className="text-right">เกณฑ์ขั้นต่ำ</TableHead>
            <TableHead className="text-right">ขาดอีก</TableHead>
            <TableHead className="text-center">สถานะ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lowStockProducts.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">ไม่มีวัสดุต่ำกว่าเกณฑ์</TableCell></TableRow>
          ) : lowStockProducts.map(p => {
            const stock = parseInt(p.stock) || 0;
            const minStock = parseInt(p.min_stock) || 0;
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.id}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{getCategoryName(p.category_id)}</TableCell>
                <TableCell>{getProductUnit(p.id)}</TableCell>
                <TableCell className="text-right">{stock.toLocaleString()}</TableCell>
                <TableCell className="text-right">{minStock.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium text-destructive">{(minStock - stock).toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="destructive">ต่ำกว่าเกณฑ์</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
