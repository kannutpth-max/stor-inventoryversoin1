import { useState, useEffect } from "react";
import { Plus, Trash2, PackageMinus, Calendar, Loader2, Printer, Save } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SignaturePad from "@/components/SignaturePad";
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
    const toDispense = items.filter(i => i.dispenseQty > 0 && i.status !== "dispensed");
    if (toDispense.length === 0) {
      toast({ variant: "destructive", title: "กรุณากรอกจำนวนจ่ายอย่างน้อย 1 รายการ" });
      return;
    }
    try {
      for (const item of toDispense) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;
        const currentStock = parseInt(product.stock) || 0;
        if (item.dispenseQty > currentStock) {
          toast({ variant: "destructive", title: `${item.productName} คงเหลือไม่เพียงพอ (คงเหลือ ${currentStock})` });
          return;
        }
        await updateProduct.mutateAsync({
          id: product.id,
          data: { ...product, stock: (currentStock - item.dispenseQty).toString() },
        });
        if (item.recordId) {
          const record = stockOuts.find(r => r.id === item.recordId);
          if (record) {
            await updateStockOut.mutateAsync({
              id: item.recordId,
              data: { ...record, status: "dispensed" },
            });
          }
        }
      }
      toast({ title: "จ่ายสินค้าและตัดสต็อกสำเร็จ" });
      navigate("/stock-out-manage");
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
          {isEditMode ? `จ่ายสินค้า - ใบเบิก ${editReqNo}` : "เบิกสินค้า"}
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
      <div className="border border-border rounded-lg p-6 bg-background print:border-none print:rounded-none print:p-2 print:text-black print:text-[11px]" id="requisition-form">
        <style>{`
          @media print {
            @page { size: A4; margin: 8mm; }
            body * { visibility: hidden; }
            #requisition-form, #requisition-form * { visibility: visible; }
            #requisition-form { position: absolute; left: 0; top: 0; width: 100%; font-size: 11px; }
            .print\\:hidden { display: none !important; }
            #requisition-form table td, #requisition-form table th {
              padding: 1px 4px !important;
              font-size: 11px !important;
              line-height: 1.2 !important;
            }
          }
        `}</style>

        {/* Header */}
        <div className="relative mb-3">
          <p className="text-sm text-muted-foreground print:text-black text-right">เลขที่รับ...............</p>
          <h1 className="text-lg font-bold text-center">ใบเบิกวัสดุสำนักงาน / งานบ้านงานครัว</h1>
          <p className="text-sm text-muted-foreground print:text-black text-center">โรงพยาบาลประชาธิปัตย์ อำเภอธัญบุรี</p>
        </div>

        {/* Form Info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-2 text-sm">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap font-medium">วันที่:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal h-8 print:border-0 print:border-b print:rounded-none print:border-black print:px-0", !date && "text-muted-foreground")} disabled={isEditMode}>
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
            <Input value={withdrawNo} onChange={(e) => setWithdrawNo(e.target.value)} placeholder="WD-XXXX" className="h-8 text-sm print:border-0 print:border-b print:rounded-none print:border-black print:px-0" disabled={isEditMode} />
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
          <Select value={departmentId} onValueChange={setDepartmentId} disabled={isEditMode}>
            <SelectTrigger className="h-8 text-sm flex-1 print:border-0 print:border-b print:rounded-none print:border-black">
              <SelectValue placeholder="เลือกหน่วยงาน" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm mb-3">มีความประสงค์ขอเบิกวัสดุที่ใช้ในราชการเพื่อจ่ายรายการดังต่อไปนี้</p>

        {/* Add item section - only in create mode */}
        {!isEditMode && (
          <div className="rounded-lg border p-3 bg-muted/30 mb-3 print:hidden">
            <div className="grid gap-3 md:grid-cols-4 items-end">
              <div className="md:col-span-2">
                <Label className="text-xs mb-1 block">เลือกสินค้า</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
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
                <TableHead rowSpan={2} className="border border-border print:border-black text-center w-12 text-foreground">ลำดับ</TableHead>
                <TableHead rowSpan={2} className="border border-border print:border-black text-center text-foreground">รายละเอียด</TableHead>
                <TableHead rowSpan={2} className="border border-border print:border-black text-center w-20 text-foreground">หน่วย</TableHead>
                <TableHead colSpan={2} className="border border-border print:border-black text-center text-foreground">คงเหลือ</TableHead>
                {isEditMode ? (
                  <TableHead colSpan={2} className="border border-border print:border-black text-center text-foreground">จำนวน</TableHead>
                ) : (
                  <TableHead rowSpan={2} className="border border-border print:border-black text-center w-20 text-foreground">จำนวนเบิก</TableHead>
                )}
                {!isEditMode && (
                  <TableHead rowSpan={2} className="border border-border print:border-black text-center text-foreground print:hidden w-12">ลบ</TableHead>
                )}
              </TableRow>
              <TableRow className="print:border-black">
                <TableHead className="border border-border print:border-black text-center w-20 text-foreground">ก่อนจ่าย</TableHead>
                <TableHead className="border border-border print:border-black text-center w-20 text-foreground">หลังจ่าย</TableHead>
                {isEditMode && (
                  <>
                    <TableHead className="border border-border print:border-black text-center w-16 text-foreground">เบิก</TableHead>
                    <TableHead className="border border-border print:border-black text-center w-16 text-foreground">จ่าย</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id} className="print:border-black h-6">
                  <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">{index + 1}</TableCell>
                  <TableCell className="border border-border print:border-black py-0.5 text-xs">{item.productName}</TableCell>
                  <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">{item.unit}</TableCell>
                  <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">{item.stock.toLocaleString()}</TableCell>
                  <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">
                    {isEditMode && item.dispenseQty > 0
                      ? (item.stock - item.dispenseQty).toLocaleString()
                      : !isEditMode
                        ? (item.stock - item.quantity).toLocaleString()
                        : item.stock.toLocaleString()}
                  </TableCell>
                  {isEditMode ? (
                    <>
                      <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">
                        {item.status === "dispensed" ? (
                          <span className="text-muted-foreground">จ่ายแล้ว</span>
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
                    </>
                  ) : (
                    <>
                      <TableCell className="border border-border print:border-black text-center py-0.5 text-xs">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="border border-border print:border-black text-center print:hidden py-0.5">
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="h-5 w-5 text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {/* Empty rows */}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <TableRow key={`empty-${i}`} className="print:border-black h-6">
                  <TableCell className="border border-border print:border-black text-center text-muted-foreground py-0.5 text-xs">{items.length + i + 1}</TableCell>
                  <TableCell className="border border-border print:border-black py-0.5">&nbsp;</TableCell>
                  <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                  <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                  <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                  {isEditMode ? (
                    <>
                      <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                      <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="border border-border print:border-black py-0.5"></TableCell>
                      <TableCell className="border border-border print:border-black print:hidden py-0.5"></TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Signature Section */}
        <div className="mt-4 text-xs print:text-[11px]">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-1">
              <p className="font-bold">เรียน หัวหน้ากลุ่มงาน / หน่วยงาน</p>
              <p className="pl-4">- เพื่อเห็นชอบให้เบิกวัสดุเพื่อใช้ในงานราชการ ใน</p>
              <p>หน่วยงาน.................................................................</p>
              <div className="mt-3 space-y-1">
                <p>ลงชื่อ..........................................ผู้เขียนคำขอ</p>
                <p>(..........................................) และ(ผู้รับวัสดุ)</p>
              </div>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-1"><span className="inline-block w-4 h-4 border border-current print:border-black"></span> เห็นชอบ</label>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-1"><span className="inline-block w-4 h-4 border border-current print:border-black"></span> ส่งคืนแก้ไขคำขอ</label>
              </div>
              <div className="mt-3 space-y-1">
                <p>(ลงชื่อ)...........................................................(ผู้เบิก)</p>
                <p>(..................................................................)</p>
                <p>ตำแหน่ง.............................................................</p>
                <p>หัวหน้ากลุ่มงาน / หน่วยงาน.................................</p>
                <p>วันที่............./................./.................</p>
              </div>
            </div>
            {/* Right Column */}
            <div className="space-y-1">
              <p className="font-bold">เรียน หัวหน้าหน่วยพัสดุ</p>
              <p className="pl-4">- เพื่ออนุมัติเบิกจ่ายวัสดุตามคำขอข้างต้น</p>
              <div className="mt-3 space-y-1">
                <p>(ลงชื่อ)........................................(ผู้จ่ายและลงทะเบียน)</p>
                <p>( ..........................................)</p>
                <p>ตำแหน่ง ........................................</p>
                <p>วันที่............./................./.................</p>
              </div>
              <div className="mt-2 space-y-1">
                <p>- อนุมัติ</p>
                <p>- รับทราบการเบิกจ่าย</p>
              </div>
              <div className="mt-3 space-y-1">
                <p>(ลงชื่อ)........................................(ผู้อนุมัติเบิกจ่าย)</p>
                <p>( ..........................................) <span className="font-bold">หัวหน้าหน่วยพัสดุ</span></p>
                <p>ตำแหน่ง ........................................</p>
                <p>วันที่............./................./.................</p>
              </div>
            </div>
          </div>
        </div>

        {/* Digital Signature Section */}
        <div className="mt-6 print:hidden">
          <h3 className="text-sm font-semibold mb-3">ลายเซ็นดิจิตอล</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SignaturePad label="ผู้เขียนคำขอ / ผู้รับวัสดุ" />
            <SignaturePad label="หัวหน้ากลุ่มงาน / หน่วยงาน" />
            <SignaturePad label="ผู้จ่ายและลงทะเบียน" />
            <SignaturePad label="ผู้เบิก" />
            <SignaturePad label="ผู้อนุมัติเบิกจ่าย" />
            <SignaturePad label="หัวหน้าหน่วยพัสดุ" />
          </div>
        </div>
      </div>
    </div>
  );
}
