import { useState } from "react";
import { FileText, Download, Printer, FileSpreadsheet, Calendar } from "lucide-react";
import ReportPreview from "@/components/reports/ReportPreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSheetData } from "@/hooks/useGoogleSheets";
import { exportToExcel, exportToPDF, buildReportData, exportStockCardToExcel, exportStockCardToPDF, exportStockBalanceToExcel, exportStockBalanceToPDF } from "@/lib/exportReport";

const reportTypes = [
  { id: "daily", name: "รายงานประจำวัน", description: "สรุปการเคลื่อนไหววัสดุประจำวัน" },
  { id: "monthly", name: "รายงานประจำเดือน", description: "สรุปการเคลื่อนไหววัสดุประจำเดือน" },
  { id: "stock-balance", name: "รายงานวัสดุคงคลัง", description: "ยอดยกมาประจำเดือน" },
  { id: "stock-card", name: "รายงานสต็อกการ์ด", description: "ประวัติการเคลื่อนไหวแต่ละวัสดุ" },
  { id: "product-movement", name: "รายงานการรับ-จ่าย", description: "รายละเอียดการรับจ่ายแต่ละวัสดุ" },
  { id: "by-company", name: "รับวัสดุแยกตามบริษัท", description: "รายงานการรับวัสดุจำแนกตามบริษัท" },
  { id: "by-department", name: "เบิกวัสดุแยกตามหน่วยงาน", description: "รายงานการเบิกจำแนกตามหน่วยงาน" },
  { id: "stock-in-history", name: "ประวัติการรับเข้า", description: "แยกตามวัสดุ" },
  { id: "stock-out-history", name: "ประวัติการเบิกจ่าย", description: "แยกตามวัสดุ" },
  { id: "low-stock", name: "วัสดุต่ำกว่าเกณฑ์", description: "รายการวัสดุที่ต่ำกว่าเกณฑ์ขั้นต่ำ" },
];

interface ProductItem { id: string; name: string; category_id?: string; }
interface CategoryItem { id: string; name: string; }
interface UnitItem { id: string; name: string; }
interface CompanyItem { id: string; name: string; }
interface DepartmentItem { id: string; name: string; }
interface StockInItem { id: string; date: string; invoice_no: string; company_id: string; product_id: string; quantity: string; }
interface StockOutItem { id: string; date: string; requisition_no: string; department_id: string; product_id: string; quantity: string; }

export default function Reports() {
  const { data: sheetProducts = [] } = useSheetData<ProductItem>("products");
  const { data: categories = [] } = useSheetData<CategoryItem>("categories");
  const { data: unitsData = [] } = useSheetData<UnitItem>("units");
  const { data: companies = [] } = useSheetData<CompanyItem>("companies");
  const { data: departments = [] } = useSheetData<DepartmentItem>("departments");
  const { data: stockIn = [] } = useSheetData<StockInItem>("stock_in");
  const { data: stockOut = [] } = useSheetData<StockOutItem>("stock_out");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [productFrom, setProductFrom] = useState("");
  const [productTo, setProductTo] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const getProductName = (id: string) => sheetProducts.find(p => p.id === id)?.name || id;
  const getProductUnit = (pid: string) => {
    const product = sheetProducts.find(p => p.id === pid) as any;
    return product ? (unitsData.find(u => u.id === product.unit_id)?.name || product.unit_id || "") : "";
  };
  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || id;
  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || id;
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || id;

  const getFilteredData = () => {
    const filterDate = (dateStr: string) => {
      if (!dateStr) return true;
      try {
        const d = parseISO(dateStr);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      } catch { return true; }
    };
    const sortedIds = [...sheetProducts].map(p => p.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const fromIdx = productFrom ? sortedIds.indexOf(productFrom) : -1;
    const toIdx = productTo ? sortedIds.indexOf(productTo) : -1;
    const lowerIdx = fromIdx >= 0 ? fromIdx : 0;
    const upperIdx = toIdx >= 0 ? toIdx : sortedIds.length - 1;
    const allowedIds = new Set(sortedIds.slice(Math.min(lowerIdx, upperIdx), Math.max(lowerIdx, upperIdx) + 1));
    const filterProduct = (pid: string) => {
      if (!productFrom && !productTo) return true;
      return allowedIds.has(pid);
    };
    let filteredStockIn = (stockIn as any[]).filter(r => filterDate(r.date) && filterProduct(r.product_id));
    let filteredStockOut = (stockOut as any[]).filter(r => filterDate(r.date) && filterProduct(r.product_id));
    if (selectedCompany) {
      filteredStockIn = filteredStockIn.filter(r => r.company_id === selectedCompany);
    }
    if (selectedDepartment) {
      filteredStockOut = filteredStockOut.filter(r => r.department_id === selectedDepartment);
    }
    return {
      products: (sheetProducts as any[]).filter(p => filterProduct(p.id)),
      stockIn: filteredStockIn,
      stockOut: filteredStockOut,
    };
  };

  const handleExport = async (type: "excel" | "pdf") => {
    if (!selectedReport) {
      toast({ variant: "destructive", title: "กรุณาเลือกรายงาน" });
      return;
    }
    const filtered = getFilteredData();
    const helperFns = { getProductName, getProductUnit, getCategoryName, getCompanyName, getDepartmentName };
    try {
      let saved: boolean;
      if (selectedReport === "stock-card") {
        const stockCardParams = {
          products: filtered.products,
          stockIn: filtered.stockIn,
          stockOut: filtered.stockOut,
          helpers: helperFns,
          dateFrom,
        };
        saved = type === "excel" ? await exportStockCardToExcel(stockCardParams) : await exportStockCardToPDF(stockCardParams);
      } else if (selectedReport === "stock-balance") {
        const params = {
          products: filtered.products,
          stockIn: filtered.stockIn,
          stockOut: filtered.stockOut,
          helpers: { getProductUnit },
          dateFrom,
          dateTo,
        };
        saved = type === "excel" ? await exportStockBalanceToExcel(params) : await exportStockBalanceToPDF(params);
      } else {
        const data = buildReportData(selectedReport, filtered.products, filtered.stockIn, filtered.stockOut, helperFns);
        saved = type === "excel" ? await exportToExcel(data) : await exportToPDF(data);
      }
      if (saved) toast({ title: `ส่งออก${type === "excel" ? " Excel" : " PDF"} สำเร็จ` });
    } catch {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการส่งออก" });
    }
  };

  const handlePreview = () => {
    if (!selectedReport) {
      toast({ variant: "destructive", title: "กรุณาเลือกรายงาน" });
      return;
    }
    setShowPreview(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            รายงาน
          </CardTitle>
          <CardDescription>เลือกประเภทรายงานและกำหนดเงื่อนไข</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Types Grid */}
          <div>
            <Label className="mb-3 block">เลือกประเภทรายงาน</Label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reportTypes.map((report) => (
                <div
                  key={report.id}
                  onClick={() => { setSelectedReport(report.id); setShowPreview(false); }}
                  className={cn(
                    "cursor-pointer rounded-lg border p-4 transition-all hover:border-primary",
                    selectedReport === report.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border"
                  )}
                >
                  <h3 className="font-medium">{report.name}</h3>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          {selectedReport && (
            <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
              <h3 className="font-medium">กำหนดเงื่อนไข</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>ตั้งแต่วันที่</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PPP", { locale: th }) : "เลือกวันที่"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>ถึงวันที่</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PPP", { locale: th }) : "เลือกวันที่"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>วัสดุเริ่มต้น</Label>
                  <Select value={productFrom} onValueChange={(v) => setProductFrom(v === "all" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกวัสดุ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">-- ทั้งหมด --</SelectItem>
                      {sheetProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.id} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>วัสดุสิ้นสุด</Label>
                  <Select value={productTo} onValueChange={(v) => setProductTo(v === "all" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกวัสดุ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">-- ทั้งหมด --</SelectItem>
                      {sheetProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.id} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Company/Department filters */}
              {selectedReport === "by-company" && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>เลือกบริษัท</Label>
                    <Select value={selectedCompany || "all"} onValueChange={(v) => setSelectedCompany(v === "all" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกบริษัท" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">-- ทั้งหมด --</SelectItem>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {selectedReport === "by-department" && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>เลือกหน่วยงาน</Label>
                    <Select value={selectedDepartment || "all"} onValueChange={(v) => setSelectedDepartment(v === "all" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกหน่วยงาน" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">-- ทั้งหมด --</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {selectedReport && (
            <div className="flex flex-wrap gap-3">
              <Button onClick={handlePreview}>
                <Printer className="mr-2 h-4 w-4" />
                แสดงตัวอย่าง
              </Button>
              <Button variant="outline" onClick={() => handleExport("excel")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                ส่งออก Excel
              </Button>
              <Button variant="outline" onClick={() => handleExport("pdf")}>
                <Download className="mr-2 h-4 w-4" />
                ส่งออก PDF
              </Button>
            </div>
          )}

          {/* Preview Area */}
          {selectedReport && (
            <div className="rounded-lg border min-h-[300px] bg-card">
              {showPreview ? (
                <div className="p-4">
                  <h3 className="font-medium mb-4 text-lg">
                    {reportTypes.find(r => r.id === selectedReport)?.name}
                  </h3>
                  <ReportPreview
                    reportType={selectedReport}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    productFrom={productFrom}
                    productTo={productTo}
                    selectedCompany={selectedCompany}
                    selectedDepartment={selectedDepartment}
                  />
                </div>
              ) : (
                <div className="p-8 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">ตัวอย่างรายงาน</p>
                    <p>คลิก "แสดงตัวอย่าง" เพื่อดูรายงาน</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
