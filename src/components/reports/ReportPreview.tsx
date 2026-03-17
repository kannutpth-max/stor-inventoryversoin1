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
}

export default function ReportPreview({ reportType, dateFrom, dateTo, productFrom, productTo, selectedCompany, selectedDepartment }: ReportPreviewProps) {
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

  const filterByProduct = (productId: string) => {
    if (productFrom && productId < productFrom) return false;
    if (productTo && productId > productTo) return false;
    return true;
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
      return <StockBalanceReport products={filteredProducts} getCategoryName={getCategoryName} getUnitName={(pid) => getProductUnit(pid)} />;
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
            <TableHead>สินค้า</TableHead>
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

function StockBalanceReport({ products, getCategoryName, getUnitName }: {
  products: Product[]; getCategoryName: (id: string) => string; getUnitName: (pid: string) => string;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>รหัส</TableHead>
            <TableHead>ชื่อสินค้า</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>หน่วย</TableHead>
            <TableHead className="text-right">ราคา</TableHead>
            <TableHead className="text-right">คงเหลือ</TableHead>
            <TableHead className="text-right">มูลค่า</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? <NoData /> : products.map(p => {
            const stock = parseInt(p.stock) || 0;
            const price = parseFloat(p.price) || 0;
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.id}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{getCategoryName(p.category_id)}</TableCell>
                <TableCell>{getUnitName(p.id)}</TableCell>
                <TableCell className="text-right">{price.toLocaleString()}</TableCell>
                <TableCell className="text-right">{stock.toLocaleString()}</TableCell>
                <TableCell className="text-right font-medium">{(stock * price).toLocaleString()}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {products.length > 0 && (
        <div className="p-4 border-t bg-muted/30 text-sm">
          <span>มูลค่ารวม: <strong className="text-primary">
            {products.reduce((s, p) => s + (parseInt(p.stock) || 0) * (parseFloat(p.price) || 0), 0).toLocaleString()} บาท
          </strong></span>
        </div>
      )}
    </div>
  );
}

function StockCardReport({ products, stockIn, stockOut, getProductUnit, getCompanyName, getDepartmentName }: {
  products: Product[]; stockIn: StockInRecord[]; stockOut: StockOutRecord[];
  getProductUnit: (id: string) => string; getCompanyName: (id: string) => string; getDepartmentName: (id: string) => string;
}) {
  return (
    <div className="space-y-6">
      {products.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">ไม่พบข้อมูล</div>
      ) : products.map(product => {
        const pIn = stockIn.filter(r => r.product_id === product.id).map(r => ({ ...r, type: "in" as const }));
        const pOut = stockOut.filter(r => r.product_id === product.id).map(r => ({ ...r, type: "out" as const }));
        const movements = [...pIn, ...pOut].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        if (movements.length === 0 && pIn.length === 0 && pOut.length === 0) return null;

        let balance = 0;
        const rows = movements.map(m => {
          const qty = parseInt(m.quantity) || 0;
          if (m.type === "in") balance += qty; else balance -= qty;
          return { ...m, qty, balance };
        });

        return (
          <div key={product.id} className="rounded-md border">
            <div className="p-3 bg-muted/50 border-b font-medium">
              {product.id} - {product.name} ({getProductUnit(product.id)})
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead className="text-right">รับเข้า</TableHead>
                  <TableHead className="text-right">เบิกออก</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">ไม่มีรายการ</TableCell></TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.type === "in" ? `รับจาก ${getCompanyName((r as any).company_id)}` : `เบิกไป ${getDepartmentName((r as any).department_id)}`}</TableCell>
                    <TableCell className="text-right text-success">{r.type === "in" ? `+${r.qty.toLocaleString()}` : ""}</TableCell>
                    <TableCell className="text-right text-destructive">{r.type === "out" ? `-${r.qty.toLocaleString()}` : ""}</TableCell>
                    <TableCell className="text-right font-medium">{r.balance.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
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
                  <TableHead>สินค้า</TableHead>
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
                  <TableHead>สินค้า</TableHead>
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
            <TableHead>สินค้า</TableHead>
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
            <TableHead>สินค้า</TableHead>
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
            <TableHead>ชื่อสินค้า</TableHead>
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
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">ไม่มีสินค้าต่ำกว่าเกณฑ์</TableCell></TableRow>
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
