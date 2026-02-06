import { useState } from "react";
import { FileText, Download, Printer, FileSpreadsheet, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const reportTypes = [
  { id: "daily", name: "รายงานประจำวัน", description: "สรุปการเคลื่อนไหวสินค้าประจำวัน" },
  { id: "monthly", name: "รายงานประจำเดือน", description: "สรุปการเคลื่อนไหวสินค้าประจำเดือน" },
  { id: "stock-balance", name: "รายงานสินค้าคงคลัง", description: "ยอดยกมาประจำเดือน" },
  { id: "stock-card", name: "รายงานสต็อกการ์ด", description: "ประวัติการเคลื่อนไหวแต่ละสินค้า" },
  { id: "product-movement", name: "รายงานการรับ-จ่าย", description: "รายละเอียดการรับจ่ายแต่ละสินค้า" },
  { id: "by-company", name: "รับสินค้าแยกตามบริษัท", description: "รายงานการรับสินค้าจำแนกตามบริษัท" },
  { id: "by-department", name: "เบิกสินค้าแยกตามหน่วยงาน", description: "รายงานการเบิกจำแนกตามหน่วยงาน" },
  { id: "stock-in-history", name: "ประวัติการรับเข้า", description: "แยกตามสินค้า" },
  { id: "stock-out-history", name: "ประวัติการเบิกจ่าย", description: "แยกตามวัสดุ" },
  { id: "low-stock", name: "สินค้าต่ำกว่าเกณฑ์", description: "รายการสินค้าที่ต่ำกว่าเกณฑ์ขั้นต่ำ" },
];

const mockProducts = [
  { id: "P001", name: "กระดาษ A4" },
  { id: "P002", name: "ปากกาลูกลื่น" },
  { id: "P003", name: "หมึกพิมพ์ HP" },
  { id: "P004", name: "แฟ้มเอกสาร" },
];

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [productFrom, setProductFrom] = useState("");
  const [productTo, setProductTo] = useState("");
  const { toast } = useToast();

  const handleExportExcel = () => {
    if (!selectedReport) {
      toast({ variant: "destructive", title: "กรุณาเลือกรายงาน" });
      return;
    }
    toast({ title: "กำลังส่งออกไฟล์ Excel...", description: "รายงานจะถูกดาวน์โหลดในไม่ช้า" });
  };

  const handleExportPDF = () => {
    if (!selectedReport) {
      toast({ variant: "destructive", title: "กรุณาเลือกรายงาน" });
      return;
    }
    toast({ title: "กำลังส่งออกไฟล์ PDF...", description: "รายงานจะถูกดาวน์โหลดในไม่ช้า" });
  };

  const handlePreview = () => {
    if (!selectedReport) {
      toast({ variant: "destructive", title: "กรุณาเลือกรายงาน" });
      return;
    }
    toast({ title: "กำลังแสดงตัวอย่างรายงาน...", description: "รายงานจะแสดงด้านล่าง" });
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
                  onClick={() => setSelectedReport(report.id)}
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
                  <Label>สินค้าเริ่มต้น</Label>
                  <Select value={productFrom} onValueChange={setProductFrom}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสินค้า" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.id} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>สินค้าสิ้นสุด</Label>
                  <Select value={productTo} onValueChange={setProductTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสินค้า" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.id} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {selectedReport && (
            <div className="flex flex-wrap gap-3">
              <Button onClick={handlePreview}>
                <Printer className="mr-2 h-4 w-4" />
                แสดงตัวอย่าง
              </Button>
              <Button variant="outline" onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                ส่งออก Excel
              </Button>
              <Button variant="outline" onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" />
                ส่งออก PDF
              </Button>
            </div>
          )}

          {/* Preview Area */}
          {selectedReport && (
            <div className="rounded-lg border p-8 min-h-[300px] flex items-center justify-center bg-card">
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">ตัวอย่างรายงาน</p>
                <p>คลิก "แสดงตัวอย่าง" เพื่อดูรายงาน</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
