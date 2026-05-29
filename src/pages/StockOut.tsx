import { useState, useEffect } from "react";
import { Plus, Trash2, PackageMinus, Calendar, Loader2, Printer, Save, Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useSearchParams, useNavigate } from "react-router-dom";

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
import { useSheetData, useSheetCreate, useSheetUpdate } from "@/hooks/useGoogleSheets";

interface Department { id: string; name: string; }
interface Product { id: string; name: string; unit_id: string; stock: string; }
interface Unit { id: string; name: string; }
interface StockOutRecord {
  id: string; date: string; requisition_no: string; department_id: string;
  product_id: string; quantity: string; status?: string; created_at: string;
}

interface StockOutItem {
  id: string; recordId?: string; productId: string; productName: string; unit: string;
  quantity: number; dispenseQty: number; stock: number; status?: string;
}

export default function StockOut() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editReqNo = searchParams.get("edit");
  const isEditMode = !!editReqNo;

  const { data: departments = [] } = useSheetData<Department>("departments");
  const { data: products = [] } = useSheetData<Product>("products");
  const { data: units = [] } = useSheetData<Unit>("units");
  const { data: stockOuts = [] } = useSheetData<StockOutRecord>("stock_out");
  const createMutation = useSheetCreate("stock_out");
  const updateStockOut = useSheetUpdate("stock_out");
  const updateProduct = useSheetUpdate("products");

  const [date, setDate] = useState<Date>(new Date());
  const [withdrawNo, setWithdrawNo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [requester, setRequester] = useState("");
  const [position, setPosition] = useState("");
  const [items, setItems] = useState<StockOutItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  const getUnitName = (unitId: string) => units.find(u => u.id === unitId)?.name || unitId;
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || "";

  // Load existing requisition data in edit mode
  useEffect(() => {
    if (isEditMode && stockOuts.length > 0 && products.length > 0 && !loaded) {
      const records = stockOuts.filter(r => r.requisition_no === editReqNo);
      if (records.length > 0) {
        const first = records[0];
        setDate(new Date(first.date));
        setWithdrawNo(first.requisition_no);
        setDepartmentId(first.department_id);
        setItems(records.map(r => {
          const product = products.find(p => p.id === r.product_id);
          const qty = parseInt(r.quantity) || 0;
          return {
            id: `item-${r.id}`,
            recordId: r.id,
            productId: r.product_id,
            productName: product?.name || r.product_id,
            unit: product ? getUnitName(product.unit_id) : "-",
            quantity: qty,
            dispenseQty: r.status === "dispensed" ? qty : qty,
            stock: parseInt(product?.stock || "0"),
            status: r.status,
          };
        }));
        setLoaded(true);
      }
    }
  }, [isEditMode, editReqNo, stockOuts, products, loaded]);

  // Auto-generate next requisition number (create mode only)
  useEffect(() => {
    if (isEditMode) return;
    if (withdrawNo) return;
    if (!stockOuts) return;
    const year = new Date().getFullYear() + 543;
    const prefix = `WD-${year}-`;
    const nums = stockOuts
      .map(r => r.requisition_no)
      .filter(n => typeof n === "string" && n.startsWith(prefix))
      .map(n => parseInt(n.slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    setWithdrawNo(`${prefix}${String(next).padStart(4, "0")}`);
  }, [isEditMode, stockOuts, withdrawNo]);

  const handleAddItem = () => {
    if (!selectedProduct || !quantity) {
      toast({ variant: "destructive", title: "กรุณาเลือกวัสดุและระบุจำนวน" });
      return;
    }
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;
    const stock = parseInt(product.stock) || 0;
    const qty = parseInt(quantity);
    if (qty > stock) {
      toast({ variant: "destructive", title: "จำนวนเกินกว่าวัสดุคงเหลือ" });
      return;
    }
    setItems([...items, {
      id: `item-${Date.now()}`, productId: product.id, productName: product.name,
      unit: getUnitName(product.unit_id), quantity: qty, dispenseQty: 0, stock,
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

  const handleDispense = async () => {
    const toDispense = items.filter(i => i.status !== "dispensed");
    if (toDispense.length === 0) {
      toast({ title: "จ่ายของครบทุกรายการแล้ว" });
      return;
    }
    try {
      for (const item of toDispense) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;
        const currentStock = parseInt(product.stock) || 0;
        const dispenseQty = item.dispenseQty || item.quantity;
        if (dispenseQty > currentStock) {
          toast({ variant: "destructive", title: `${item.productName} คงเหลือไม่เพียงพอ (คงเหลือ ${currentStock})` });
          return;
        }
        await updateProduct.mutateAsync({
          id: product.id,
          data: { ...product, stock: (currentStock - dispenseQty).toString() },
        });
        if (item.recordId) {
          const record = stockOuts.find(r => r.id === item.recordId);
          if (record) {
            await updateStockOut.mutateAsync({
              id: item.recordId,
              data: { ...record, status: "dispensed", quantity: dispenseQty.toString() },
            });
          }
        }
      }
      toast({ title: "จ่ายวัสดุและตัดสต็อกสำเร็จ" });
      setItems(items.map(i => ({ ...i, status: "dispensed" })));
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const handlePrint = () => window.print();

  const updateDispenseQty = (id: string, qty: number) => {
    setItems(items.map(i => i.id === id ? { ...i, dispenseQty: qty } : i));
  };

  const emptyRows = Math.max(0, 17 - items.length);

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PackageMinus className="h-5 w-5" />
          {isEditMode ? `จ่ายวัสดุ - ใบเบิก ${editReqNo}` : "เบิกวัสดุ"}
          {isEditMode && (
            <span className={`ml-2 text-sm font-normal px-2 py-0.5 rounded ${items.every(i => i.status === "dispensed") ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {items.every(i => i.status === "dispensed") ? "จ่ายของแล้ว" : "รอจ่าย"}
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            พิมพ์ใบเบิก
          </Button>
          {isEditMode ? (
            items.every(i => i.status === "dispensed") ? (
              <Button disabled variant="outline">
                <Save className="mr-2 h-4 w-4" />
                จ่ายของแล้ว
              </Button>
            ) : (
              <Button onClick={handleDispense} disabled={updateStockOut.isPending || updateProduct.isPending}>
                {(updateStockOut.isPending || updateProduct.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                จ่ายของแล้ว
              </Button>
            )
          ) : (
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PackageMinus className="mr-2 h-4 w-4" />
              บันทึกรายการเบิก
            </Button>
          )}
        </div>
      </div>

      {/* Printable Form */}
      <div className="border border-border rounded-lg p-6 bg-background print:border-none print:rounded-none print:p-0 print:text-black" id="requisition-form">
        <style>{`
           @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
           @media print {
             @page { size: A4; margin: 3mm 8mm; }
             body * { visibility: hidden; }
             #requisition-form, #requisition-form * { visibility: visible; }
             #requisition-form {
               position: absolute; left: 0; top: 0; width: 100%;
               font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important;
                font-size: 11pt;
                 font-weight: 200 !important;
                 line-height: 1.6;
                 color: #555 !important;
               }
               #requisition-form * {
                 font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important;
                 font-weight: 200 !important;
                 color: #555 !important;
              }
             .print\\:hidden { display: none !important; }
             #requisition-form h1 { font-size: 16pt !important; margin: 0 !important; font-weight: 400 !important; color: #333 !important; }
             #requisition-form .font-bold { font-weight: 400 !important; color: #333 !important; }
             #requisition-form table th { font-weight: 300 !important; color: #444 !important; }
             #requisition-form table td, #requisition-form table th { border-color: #888 !important; }
             #requisition-form .form-subtitle { font-size: 11pt !important; }
             #requisition-form .form-info, #requisition-form .form-info * { font-size: 11pt !important; line-height: 1.7 !important; }
             #requisition-form .form-info p { margin: 4px 0 !important; }
             #requisition-form table { border-collapse: collapse !important; }
             #requisition-form table td, #requisition-form table th {
               padding: 2px 3px !important;
               font-size: 11pt !important;
               line-height: 1.1 !important;
               border-color: #000 !important;
             }
             #requisition-form .sig-section {
               margin-top: 2px !important;
               page-break-inside: avoid;
               display: grid !important;
               font-size: 11pt !important;
             }
             #requisition-form .sig-section p { margin: 2px 0 !important; padding: 0 !important; line-height: 1.7 !important; }
             #requisition-form .sig-section .checkbox-item {
               display: inline-flex; align-items: center; gap: 3px; margin: 0;
             }
             #requisition-form .sig-section .checkbox-box {
               width: 10px; height: 10px; border: 1px solid #000; display: inline-block; flex-shrink: 0;
             }
              #requisition-form .sig-grid { gap: 8px !important; }
              #requisition-form .receipt-no { font-size: 11pt !important; }
              #requisition-form .dotted-underline {
                border-bottom: 1px dotted #555;
                padding: 0 4px;
                margin: 0 2px;
                display: inline-block;
                min-width: 40px;
                line-height: 1.1;
              }
            }
         `}</style>

        {/* Header */}
        <div className="relative mb-1 print:mb-0">
          <p className="text-sm text-muted-foreground print:text-black text-right receipt-no">เลขที่เบิก<span className="dotted-underline" style={{ minWidth: '180px' }}>{withdrawNo || '\u00A0'}</span></p>
          <h1 className="text-lg font-bold text-center print:text-[20pt]">ใบเบิกวัสดุสำนักงาน / งานบ้านงานครัว</h1>
          <p className="text-sm text-muted-foreground print:text-black text-right form-subtitle">โรงพยาบาลประชาธิปัตย์</p>
          <p className="text-sm text-muted-foreground print:text-black text-right form-info">วันที่<span className="dotted-underline" style={{ minWidth: '40px' }}>{date ? format(date, "d") : '\u00A0'}</span>เดือน<span className="dotted-underline" style={{ minWidth: '110px' }}>{date ? format(date, "MMMM", { locale: th }) : '\u00A0'}</span>พ.ศ.<span className="dotted-underline" style={{ minWidth: '60px' }}>{date ? (date.getFullYear() + 543).toString() : '\u00A0'}</span></p>
        </div>

        {/* Form Info */}
        <div className="space-y-1 print:space-y-0 mb-2 print:mb-0 text-sm form-info">
          <div className="hidden print:flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium">เรียน ผู้อำนวยการโรงพยาบาลประชาธิปัตย์</Label>
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium print:hidden">ข้าพเจ้า</Label>
            <Input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="ชื่อผู้เบิก" className="h-8 text-sm flex-1 print:hidden" />
            <Label className="whitespace-nowrap font-medium print:hidden">ตำแหน่ง</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="ตำแหน่ง" className="h-8 text-sm flex-1 print:hidden" />
          </div>
          <div className="hidden print:block form-info">
            <p>ข้าพเจ้า<span className="dotted-underline" style={{ minWidth: '320px' }}>{requester || '\u00A0'}</span>ตำแหน่ง<span className="dotted-underline" style={{ minWidth: '260px' }}>{position || '\u00A0'}</span></p>
          </div>
          <div className="hidden print:block form-info">
            <p>หน่วยงานผู้เบิก (ฝ่าย/งาน)<span className="dotted-underline" style={{ minWidth: '380px' }}>{getDepartmentName(departmentId) || '\u00A0'}</span>มีความประสงค์จะขอเบิกวัสดุเพื่อใช้ในราชการดังรายการต่อไปนี้</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <Label className="whitespace-nowrap font-medium text-xs">หน่วยงานผู้เบิก (ฝ่าย/งาน)</Label>
            <Select value={departmentId} onValueChange={setDepartmentId} disabled={isEditMode}>
              <SelectTrigger className="h-8 text-sm min-w-[200px] flex-1">
                <SelectValue placeholder="เลือกหน่วยงาน" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Hidden date/withdraw fields for data binding - print:hidden */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-2 text-sm form-info print:hidden">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium">วันที่:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal h-8", !date && "text-muted-foreground")} disabled={isEditMode}>
                  <Calendar className="mr-2 h-3 w-3" />
                  {date ? format(date, "d MMMM yyyy", { locale: th }) : "เลือกวันที่"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium">เลขที่:</Label>
            <Input value={withdrawNo} onChange={(e) => setWithdrawNo(e.target.value)} placeholder="WD-XXXX" className="h-8 text-sm" disabled={isEditMode} />
          </div>
        </div>

        <p className="text-sm mb-3 form-info print:hidden">มีความประสงค์ขอเบิกวัสดุที่ใช้ในราชการเพื่อจ่ายรายการดังต่อไปนี้</p>

        {/* Add item section - only in create mode */}
        {!isEditMode && (
          <div className="rounded-lg border p-3 bg-muted/30 mb-3 print:hidden">
            <div className="grid gap-3 md:grid-cols-4 items-end">
              <div className="md:col-span-2">
                <Label className="text-xs mb-1 block">เลือกวัสดุ</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือกวัสดุ" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} (คงเหลือ: {p.stock || 0})</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">จำนวน</Label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="จำนวน" className="h-8 text-sm" />
              </div>
              <Button onClick={handleAddItem} size="sm" className="h-8"><Plus className="mr-1 h-3 w-3" />เพิ่มรายการ</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="border border-border print:border-black">
          <Table>
            <TableHeader>
              <TableRow className="print:border-black">
                <TableHead rowSpan={2} className="border border-border print:border-black text-center w-12 text-foreground">ลำดับที่</TableHead>
                <TableHead rowSpan={2} className="border border-border print:border-black text-center text-foreground">รหัส/รายการ</TableHead>
                <TableHead rowSpan={2} className="border border-border print:border-black text-center w-16 text-foreground">หน่วย</TableHead>
                <TableHead colSpan={1} className="border border-border print:border-black text-center text-foreground">คงเหลือ</TableHead>
                <TableHead colSpan={2} className="border border-border print:border-black text-center text-foreground">จำนวน</TableHead>
                <TableHead colSpan={1} className="border border-border print:border-black text-center text-foreground">คงเหลือ</TableHead>
                {!isEditMode && (
                  <TableHead rowSpan={2} className="border border-border print:border-black text-center text-foreground print:hidden w-12">ลบ</TableHead>
                )}
              </TableRow>
              <TableRow className="print:border-black">
                <TableHead className="border border-border print:border-black text-center w-16 text-foreground">ก่อนจ่าย</TableHead>
                <TableHead className="border border-border print:border-black text-center w-14 text-foreground">เบิก</TableHead>
                <TableHead className="border border-border print:border-black text-center w-14 text-foreground">จ่าย</TableHead>
                <TableHead className="border border-border print:border-black text-center w-16 text-foreground">หลังจ่าย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id} className="print:border-black h-6 print:h-[18px]">
                  <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">{index + 1}</TableCell>
                  <TableCell className="border border-border print:border-black py-0.5 text-xs">{item.productName}</TableCell>
                  <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">{item.unit}</TableCell>
                  <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">{item.stock.toLocaleString()}</TableCell>
                  <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">{item.quantity.toLocaleString()}</TableCell>
                  {isEditMode ? (
                    <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">
                      {item.status === "dispensed" ? (
                        <span className="text-muted-foreground">{item.dispenseQty || item.quantity}</span>
                      ) : (
                        <Input
                          type="number"
                          value={item.dispenseQty || ""}
                          onChange={(e) => updateDispenseQty(item.id, parseInt(e.target.value) || 0)}
                          className="h-6 w-16 text-xs text-center p-0 mx-auto print:border-0 print:border-b print:rounded-none"
                          max={item.quantity}
                        />
                      )}
                    </TableCell>
                  ) : (
                    <TableCell className="border border-border print:border-black text-center py-0.5 text-xs"></TableCell>
                  )}
                  <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">
                    {isEditMode && item.dispenseQty > 0
                      ? (item.stock - item.dispenseQty).toLocaleString()
                      : !isEditMode
                        ? (item.stock - item.quantity).toLocaleString()
                        : item.stock.toLocaleString()}
                  </TableCell>
                  {!isEditMode && (
                    <TableCell className="border border-border print:border-black text-center print:hidden py-0.5">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="h-5 w-5 text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {/* Empty rows */}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <TableRow key={`empty-${i}`} className="print:border-black h-6 print:h-[18px]">
                  <TableCell className="border border-border print:border-black text-center text-muted-foreground py-0.5 text-xs">{items.length + i + 1}</TableCell>
                  <TableCell className="border border-border print:border-black py-0.5">&nbsp;</TableCell>
                  <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                  <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                  <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                  <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                  <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                  {!isEditMode && (
                    <TableCell className="border border-border print:border-black print:hidden py-0.5"></TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Signature Section */}
        <div className="hidden print:block mt-3 print:mt-1 text-xs sig-section">
          <div className="grid grid-cols-2 gap-6 print:gap-4 sig-grid">
            {/* Left Column */}
            <div className="space-y-0">
              <p className="font-bold">เรียน หัวหน้ากลุ่มงาน / หน่วยงาน</p>
              <p className="pl-4">- เพื่อเห็นชอบให้เบิกวัสดุเพื่อใช้ในงานราชการ ใน</p>
              <p>หน่วยงาน.................................................................</p>
              <p>&nbsp;</p>
              <p className="text-center">ลงชื่อ..............................................ผู้เขียนคำขอ</p>
              <p className="text-center">(.............................................) และ(ผู้รับวัสดุ)</p>

              <div className="flex justify-center gap-4 mt-0">
                <label className="flex items-center gap-1 checkbox-item">
                  <span className="inline-block w-3 h-3 border border-current print:border-black checkbox-box"></span> เห็นชอบ
                </label>
                <label className="flex items-center gap-1 checkbox-item">
                  <span className="inline-block w-3 h-3 border border-current print:border-black checkbox-box"></span> ส่งคืนแก้ไขคำขอ
                </label>
              </div>
              <p>&nbsp;</p>
              <p className="text-center">(ลงชื่อ)................................................................(ผู้เบิก)</p>
              <p className="text-center">(..................................................................)</p>
              <p className="text-center">ตำแหน่ง.................................................................</p>
              <p className="text-center">หัวหน้ากลุ่มงาน / หน่วยงาน.............................................</p>
              <p className="text-center">วันที่............../................../..................</p>
            </div>

            {/* Right Column */}
            <div className="space-y-0">
              <p className="font-bold">เรียน หัวหน้าหน่วยพัสดุ</p>
              <p className="pl-4">- เพื่ออนุมัติเบิกจ่ายวัสดุตามคำขอข้างต้น</p>
              <p>&nbsp;</p>
              <p className="text-center">(ลงชื่อ)...........................................(ผู้จ่ายและลงทะเบียน)</p>
              <p className="text-center">( นางสาวกัญญารัตน์ สวัสดิ )</p>
              <p className="text-center">ตำแหน่ง นักวิชาการพัสดุ</p>
              <p className="text-center">วันที่............../................../..................</p>

              <p className="pl-4 mt-0">- อนุมัติ</p>
              <p className="pl-4">- รับทราบการเบิกจ่าย</p>
              <p>&nbsp;</p>
              <p className="text-center">(ลงชื่อ)...........................................(ผู้อนุมัติเบิกจ่าย)</p>
              <p className="text-center">( นายไพศาล น้อยเกิด ) หัวหน้าหน่วยพัสดุ</p>
              <p className="text-center">ตำแหน่ง เจ้าพนักงานธุรการชำนาญงาน</p>
              <p className="text-center">วันที่............../................../..................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
