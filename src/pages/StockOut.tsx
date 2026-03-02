import { useState } from "react";
import { Plus, Trash2, PackageMinus, Calendar, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSheetData, useSheetCreate } from "@/hooks/useGoogleSheets";

interface Department { id: string; name: string; }
interface Product { id: string; name: string; unit_id: string; stock: string; }
interface Unit { id: string; name: string; }

interface StockOutItem {
  id: string; productId: string; productName: string; unit: string;
  quantity: number; stock: number;
}

export default function StockOut() {
  const { data: departments = [] } = useSheetData<Department>("departments");
  const { data: products = [] } = useSheetData<Product>("products");
  const { data: units = [] } = useSheetData<Unit>("units");
  const createMutation = useSheetCreate("stock_out");

  const [date, setDate] = useState<Date>(new Date());
  const [withdrawNo, setWithdrawNo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [requester, setRequester] = useState("");
  const [position, setPosition] = useState("");
  const [items, setItems] = useState<StockOutItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const { toast } = useToast();

  const getUnitName = (unitId: string) => units.find(u => u.id === unitId)?.name || unitId;
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || "";

  const handleAddItem = () => {
    if (!selectedProduct || !quantity) {
      toast({ variant: "destructive", title: "กรุณาเลือกสินค้าและระบุจำนวน" });
      return;
    }
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;
    const stock = parseInt(product.stock) || 0;
    const qty = parseInt(quantity);
    if (qty > stock) {
      toast({ variant: "destructive", title: "จำนวนเกินกว่าสินค้าคงเหลือ" });
      return;
    }

    setItems([...items, {
      id: `item-${Date.now()}`, productId: product.id, productName: product.name,
      unit: getUnitName(product.unit_id), quantity: qty, stock,
    }]);
    setSelectedProduct(""); setQuantity("");
  };

  const handleRemoveItem = (id: string) => setItems(items.filter((item) => item.id !== id));

  const handleSave = async () => {
    if (!date || !withdrawNo || !departmentId || items.length === 0) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }
    try {
      for (const item of items) {
        await createMutation.mutateAsync({
          id: `SO-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          date: format(date, "yyyy-MM-dd"),
          requisition_no: withdrawNo,
          department_id: departmentId,
          product_id: item.productId,
          quantity: item.quantity.toString(),
          created_at: new Date().toISOString(),
        });
      }
      toast({ title: "บันทึกรายการเบิกสำเร็จ" });
      setWithdrawNo(""); setDepartmentId(""); setItems([]);
      setRequester(""); setPosition("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Generate empty rows to fill the form
  const emptyRows = Math.max(0, 17 - items.length);

  return (
    <div className="space-y-4">
      {/* Action buttons - hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PackageMinus className="h-5 w-5" />
          เบิกสินค้า
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            พิมพ์ใบเบิก
          </Button>
          <Button onClick={handleSave} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <PackageMinus className="mr-2 h-4 w-4" />
            บันทึกรายการเบิก
          </Button>
        </div>
      </div>

      {/* Add item section - hidden when printing */}
      <div className="rounded-lg border p-4 bg-muted/30 print:hidden">
        <h3 className="font-medium mb-4">เพิ่มรายการเบิก</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} (คงเหลือ: {p.stock || 0})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="จำนวน" />
          <Button onClick={handleAddItem} className="w-full"><Plus className="mr-2 h-4 w-4" />เพิ่ม</Button>
        </div>
      </div>

      {/* Printable Form */}
      <div className="border border-border rounded-lg p-6 bg-background print:border-black print:rounded-none print:p-4 print:text-black" id="requisition-form">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #requisition-form, #requisition-form * { visibility: visible; }
            #requisition-form { position: absolute; left: 0; top: 0; width: 100%; font-size: 14px; }
            .print\\:hidden { display: none !important; }
          }
        `}</style>

        {/* Header */}
        <div className="text-center space-y-1 mb-4">
          <p className="text-sm text-muted-foreground print:text-black">เลขที่รับ...............</p>
          <h1 className="text-lg font-bold">ใบเบิกวัสดุสำนักงาน / งานบ้านงานครัว</h1>
          <p className="text-sm text-muted-foreground print:text-black">โรงพยาบาลจังหวัด................</p>
        </div>

        {/* Form Info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-2 text-sm">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium">วันที่:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal h-8 print:border-0 print:border-b print:rounded-none print:border-black print:px-0", !date && "text-muted-foreground")}>
                  <Calendar className="mr-2 h-3 w-3 print:hidden" />
                  {date ? format(date, "d MMMM yyyy", { locale: th }) : "เลือกวันที่"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 print:hidden" align="start">
                <CalendarComponent mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium">เลขที่:</Label>
            <Input value={withdrawNo} onChange={(e) => setWithdrawNo(e.target.value)} placeholder="WD-XXXX" className="h-8 text-sm print:border-0 print:border-b print:rounded-none print:border-black print:px-0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-2 text-sm">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium">เรียน:</Label>
            <span className="text-muted-foreground print:text-black">ผู้อำนวยการโรงพยาบาลจังหวัด</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-2 text-sm">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium">ข้าพเจ้า:</Label>
            <Input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="ชื่อผู้เบิก" className="h-8 text-sm print:border-0 print:border-b print:rounded-none print:border-black print:px-0" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium">ตำแหน่ง:</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="ตำแหน่ง" className="h-8 text-sm print:border-0 print:border-b print:rounded-none print:border-black print:px-0" />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 text-sm">
          <Label className="whitespace-nowrap font-medium">หน่วยงานที่เบิก (ฝ่ายงาน):</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="h-8 text-sm flex-1 print:border-0 print:border-b print:rounded-none print:border-black">
              <SelectValue placeholder="เลือกหน่วยงาน" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm mb-2">มีความประสงค์ขอเบิกวัสดุที่ใช้ในราชการเพื่อจ่ายรายการดังต่อไปนี้</p>

        {/* Table */}
        <div className="border border-border print:border-black">
          <Table>
            <TableHeader>
              <TableRow className="print:border-black">
                <TableHead rowSpan={2} className="border border-border print:border-black text-center w-12 text-foreground">ลำดับ</TableHead>
                <TableHead rowSpan={2} className="border border-border print:border-black text-center text-foreground">รายละเอียด</TableHead>
                <TableHead rowSpan={2} className="border border-border print:border-black text-center w-20 text-foreground">หน่วย</TableHead>
                <TableHead colSpan={2} className="border border-border print:border-black text-center text-foreground">คงเหลือ</TableHead>
                <TableHead colSpan={2} className="border border-border print:border-black text-center text-foreground">จำนวน</TableHead>
                <TableHead rowSpan={2} className="border border-border print:border-black text-center text-foreground print:hidden w-12">ลบ</TableHead>
              </TableRow>
              <TableRow className="print:border-black">
                <TableHead className="border border-border print:border-black text-center w-20 text-foreground">ก่อนจ่าย</TableHead>
                <TableHead className="border border-border print:border-black text-center w-20 text-foreground">หลังจ่าย</TableHead>
                <TableHead className="border border-border print:border-black text-center w-16 text-foreground">เบิก</TableHead>
                <TableHead className="border border-border print:border-black text-center w-16 text-foreground">จ่าย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id} className="print:border-black">
                  <TableCell className="border border-border print:border-black text-center">{index + 1}</TableCell>
                  <TableCell className="border border-border print:border-black">{item.productName}</TableCell>
                  <TableCell className="border border-border print:border-black text-center">{item.unit}</TableCell>
                  <TableCell className="border border-border print:border-black text-center">{item.stock.toLocaleString()}</TableCell>
                  <TableCell className="border border-border print:border-black text-center">{(item.stock - item.quantity).toLocaleString()}</TableCell>
                  <TableCell className="border border-border print:border-black text-center">{item.quantity.toLocaleString()}</TableCell>
                  <TableCell className="border border-border print:border-black text-center"></TableCell>
                  <TableCell className="border border-border print:border-black text-center print:hidden">
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {/* Empty rows to fill the form */}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <TableRow key={`empty-${i}`} className="print:border-black">
                  <TableCell className="border border-border print:border-black text-center text-muted-foreground">{items.length + i + 1}</TableCell>
                  <TableCell className="border border-border print:border-black">&nbsp;</TableCell>
                  <TableCell className="border border-border print:border-black"></TableCell>
                  <TableCell className="border border-border print:border-black"></TableCell>
                  <TableCell className="border border-border print:border-black"></TableCell>
                  <TableCell className="border border-border print:border-black"></TableCell>
                  <TableCell className="border border-border print:border-black"></TableCell>
                  <TableCell className="border border-border print:border-black print:hidden"></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Signature Section */}
        <div className="mt-10 text-sm">
          {/* Row 1: Requester & Department Head */}
          <div className="grid grid-cols-2 gap-12">
            <div className="text-center space-y-8">
              <p className="font-medium text-left">ผู้เบิก</p>
              <div className="space-y-1 pt-4">
                <p>ลงชื่อ..............................................</p>
                <p>(.............................................)</p>
                <p>ตำแหน่ง........................................</p>
                <p>วันที่......../............/............</p>
              </div>
            </div>
            <div className="text-center space-y-8">
              <p className="font-medium text-left">หัวหน้ากลุ่มงาน / หน่วยงาน</p>
              <div className="space-y-1 pt-4">
                <p>ลงชื่อ..............................................</p>
                <p>(.............................................)</p>
                <p>ตำแหน่ง........................................</p>
                <p>วันที่......../............/............</p>
              </div>
            </div>
          </div>

          {/* Row 2: Issuer & Approver */}
          <div className="grid grid-cols-2 gap-12 mt-10">
            <div className="text-center space-y-8">
              <p className="font-medium text-left">ผู้จ่ายของและตรวจนับ</p>
              <div className="space-y-1 pt-4">
                <p>ลงชื่อ..............................................</p>
                <p>(.............................................)</p>
                <p>ตำแหน่ง........................................</p>
                <p>วันที่......../............/............</p>
              </div>
            </div>
            <div className="text-center space-y-8">
              <p className="font-medium text-left">ผู้อนุมัติ</p>
              <div className="space-y-1 pt-4">
                <p>ลงชื่อ..............................................</p>
                <p>(.............................................)</p>
                <p>ตำแหน่ง........................................</p>
                <p>วันที่......../............/............</p>
              </div>
            </div>
          </div>

          {/* Row 3: Receiver */}
          <div className="grid grid-cols-2 gap-12 mt-10">
            <div className="text-center space-y-8">
              <p className="font-medium text-left">ผู้รับของ</p>
              <div className="space-y-1 pt-4">
                <p>ลงชื่อ..............................................</p>
                <p>(.............................................)</p>
                <p>ตำแหน่ง........................................</p>
                <p>วันที่......../............/............</p>
              </div>
            </div>
            <div className="text-center space-y-8">
              <p className="font-medium text-left">หัวหน้าหน่วยพัสดุ</p>
              <div className="space-y-1 pt-4">
                <p>ลงชื่อ..............................................</p>
                <p>(.............................................)</p>
                <p>ตำแหน่ง........................................</p>
                <p>วันที่......../............/............</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
