import { useState } from "react";
import { Plus, Trash2, PackagePlus, Calendar, FileText, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Company { id: string; name: string; }
interface Product { id: string; name: string; unit_id: string; stock: string; price: string; }
interface Unit { id: string; name: string; }

interface StockInItem {
  id: string; productId: string; productName: string; unit: string;
  quantity: number; price: number;
}

export default function StockIn() {
  const { data: companies = [] } = useSheetData<Company>("companies");
  const { data: products = [] } = useSheetData<Product>("products");
  const { data: units = [] } = useSheetData<Unit>("units");
  const createMutation = useSheetCreate("stock_in");
  const updateProduct = useSheetUpdate("products");

  const [date, setDate] = useState<Date>(new Date());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<StockInItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const { toast } = useToast();

  const getUnitName = (unitId: string) => units.find(u => u.id === unitId)?.name || unitId;

  const handleAddItem = () => {
    if (!selectedProduct || !quantity) {
      toast({ variant: "destructive", title: "กรุณาเลือกวัสดุและระบุจำนวน" });
      return;
    }
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    setItems([...items, {
      id: `item-${Date.now()}`, productId: product.id, productName: product.name,
      unit: getUnitName(product.unit_id), quantity: parseInt(quantity), price: parseFloat(price) || 0,
    }]);
    setSelectedProduct(""); setQuantity(""); setPrice("");
  };

  const handleRemoveItem = (id: string) => setItems(items.filter((item) => item.id !== id));

  const handleSave = async () => {
    if (!date || !invoiceNo || !companyId || items.length === 0) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }
    try {
      // สร้างรายการรับเข้าทั้งหมดก่อน
      for (const item of items) {
        await createMutation.mutateAsync({
          id: `SI-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          date: format(date, "yyyy-MM-dd"),
          invoice_no: invoiceNo,
          company_id: companyId,
          product_id: item.productId,
          quantity: item.quantity.toString(),
          created_at: new Date().toISOString(),
        });
      }

      // รวมจำนวนสต็อกที่ต้องเพิ่มต่อวัสดุ
      const stockChanges = new Map<string, number>();
      for (const item of items) {
        const prev = stockChanges.get(item.productId) || 0;
        stockChanges.set(item.productId, prev + item.quantity);
      }

      // อัพเดทสต็อกวัสดุทีละรายการ พร้อมหน่วงเวลาเล็กน้อย
      for (const [productId, addQty] of stockChanges) {
        const product = products.find(p => p.id === productId);
        if (product) {
          const currentStock = parseInt(product.stock) || 0;
          try {
            await updateProduct.mutateAsync({
              id: product.id,
              data: { ...product, stock: (currentStock + addQty).toString() },
            });
          } catch (e) {
            console.warn(`Failed to update stock for ${productId}, retrying...`);
            await new Promise(r => setTimeout(r, 1000));
            await updateProduct.mutateAsync({
              id: product.id,
              data: { ...product, stock: (currentStock + addQty).toString() },
            });
          }
          // หน่วงเวลาระหว่างการอัพเดทแต่ละวัสดุ
          await new Promise(r => setTimeout(r, 500));
        }
      }
      toast({ title: "บันทึกรายการรับเข้าสำเร็จ" });
      setInvoiceNo(""); setCompanyId(""); setItems([]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            รับเข้าวัสดุ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>วันที่รับเข้า</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: th }) : "เลือกวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>เลขที่ใบส่งของ</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-XXXX" className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>จากบริษัท</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="เลือกบริษัท" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-muted/30">
            <h3 className="font-medium mb-4">เพิ่มรายการวัสดุ</h3>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <Select value={selectedProduct} onValueChange={(val) => {
                  setSelectedProduct(val);
                  const p = products.find(prod => prod.id === val);
                  if (p && p.price) setPrice(p.price);
                }}>
                  <SelectTrigger><SelectValue placeholder="เลือกวัสดุ" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="จำนวน" />
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="ราคา/หน่วย" />
              <Button onClick={handleAddItem} className="w-full"><Plus className="mr-2 h-4 w-4" />เพิ่ม</Button>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสวัสดุ</TableHead><TableHead>ชื่อวัสดุ</TableHead><TableHead>หน่วย</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">ราคา/หน่วย</TableHead>
                  <TableHead className="text-right">รวม</TableHead><TableHead className="text-center">ลบ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">ยังไม่มีรายการวัสดุ</TableCell></TableRow>
                ) : items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.productId}</TableCell><TableCell>{item.productName}</TableCell><TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.price.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{(item.quantity * item.price).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">ยอดรวมทั้งสิ้น: <span className="text-primary">{totalAmount.toLocaleString()} บาท</span></div>
            <Button onClick={handleSave} size="lg" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PackagePlus className="mr-2 h-4 w-4" />
              บันทึกรายการรับเข้า
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
