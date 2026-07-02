import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Trash2, PackagePlus, Calendar, FileText, Loader2, Check, ChevronsUpDown, X } from "lucide-react";
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
import { cn, formatThaiBuddhistDate, parseSheetDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSheetData, useSheetCreate, useSheetUpdate, useSheetDelete } from "@/hooks/useGoogleSheets";

interface Company { id: string; name: string; }
interface Product { id: string; name: string; unit_id: string; stock: string; price: string; }
interface Unit { id: string; name: string; }

interface StockInItem {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  price: number;
  recordId?: string;       // existing stock_in record id (edit mode)
  originalQty?: number;    // original qty when loaded (edit mode)
}

interface EditRecord {
  id: string;
  date: string;
  invoice_no: string;
  company_id: string;
  product_id: string;
  quantity: string;
  created_at: string;
}

export default function StockIn() {
  const location = useLocation();
  const navigate = useNavigate();
  const editState = (location.state as { editInvoice?: string; records?: EditRecord[] } | null) || null;

  const { data: companies = [] } = useSheetData<Company>("companies");
  const { data: products = [] } = useSheetData<Product>("products");
  const { data: units = [] } = useSheetData<Unit>("units");
  const createMutation = useSheetCreate("stock_in");
  const updateStockIn = useSheetUpdate("stock_in");
  const deleteStockIn = useSheetDelete("stock_in");
  const updateProduct = useSheetUpdate("products");

  const [date, setDate] = useState<Date>(new Date());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<StockInItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [removedRecordIds, setRemovedRecordIds] = useState<string[]>([]);
  const [removedOriginalQty, setRemovedOriginalQty] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { toast } = useToast();

  const getUnitName = (unitId: string) => units.find(u => u.id === unitId)?.name || unitId;

  // Hydrate from edit state once products/units are loaded
  useEffect(() => {
    if (hydrated || !editState?.editInvoice || !editState.records || products.length === 0) return;
    const first = editState.records[0];
    setEditMode(true);
    setInvoiceNo(first.invoice_no);
    setCompanyId(first.company_id);
    try { setDate(parseSheetDate(first.date)); } catch {}
    const loaded: StockInItem[] = editState.records.map((r, idx) => {
      const product = products.find(p => p.id === r.product_id);
      const qty = parseInt(r.quantity) || 0;
      return {
        id: `edit-${r.id}-${idx}`,
        productId: r.product_id,
        productName: product?.name || r.product_id,
        unit: product ? getUnitName(product.unit_id) : "",
        quantity: qty,
        price: parseFloat(product?.price || "0") || 0,
        recordId: r.id,
        originalQty: qty,
      };
    });
    setItems(loaded);
    setHydrated(true);
  }, [editState, products, units, hydrated]);

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

  const handleRemoveItem = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item?.recordId) {
      setRemovedRecordIds(prev => [...prev, item.recordId!]);
      setRemovedOriginalQty(prev => {
        const m = new Map(prev);
        m.set(item.recordId!, (m.get(item.recordId!) || 0) + (item.originalQty || 0));
        // Also track per-product net (we'll compute later from removedRecordIds via items lookup is gone, so persist productId)
        return m;
      });
    }
    setItems(items.filter((it) => it.id !== id));
  };

  // Track removed items' productId+originalQty separately to compute stock revert
  const [removedItems, setRemovedItems] = useState<{ productId: string; qty: number }[]>([]);
  const handleRemoveItemFull = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (item.recordId) {
      setRemovedRecordIds(prev => [...prev, item.recordId!]);
      setRemovedItems(prev => [...prev, { productId: item.productId, qty: item.originalQty || 0 }]);
    }
    setItems(items.filter((it) => it.id !== id));
  };

  const cancelEdit = () => {
    navigate("/stock-in-manage");
  };

  const handleSave = async () => {
    if (!date || !invoiceNo || !companyId || items.length === 0) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }
    setSaving(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      // 1. Determine net stock change per product (delta-only)
      const stockChanges = new Map<string, number>();
      const addDelta = (pid: string, delta: number) => {
        stockChanges.set(pid, (stockChanges.get(pid) || 0) + delta);
      };

      // 2. Process each item: update if changed, create if new, skip if unchanged
      for (const item of items) {
        if (item.recordId) {
          const delta = item.quantity - (item.originalQty || 0);
          if (delta !== 0) {
            await updateStockIn.mutateAsync({
              id: item.recordId,
              data: {
                id: item.recordId,
                date: dateStr,
                invoice_no: invoiceNo,
                company_id: companyId,
                product_id: item.productId,
                quantity: item.quantity.toString(),
                created_at: new Date().toISOString(),
              },
            });
            addDelta(item.productId, delta);
            await new Promise(r => setTimeout(r, 200));
          }
        } else {
          // new item: create + add full qty to stock
          await createMutation.mutateAsync({
            id: `SI-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            date: dateStr,
            invoice_no: invoiceNo,
            company_id: companyId,
            product_id: item.productId,
            quantity: item.quantity.toString(),
            created_at: new Date().toISOString(),
          });
          addDelta(item.productId, item.quantity);
          await new Promise(r => setTimeout(r, 200));
        }
      }

      // 3. Delete removed records and subtract their qty
      for (const recId of removedRecordIds) {
        await deleteStockIn.mutateAsync(recId);
        await new Promise(r => setTimeout(r, 200));
      }
      for (const r of removedItems) {
        addDelta(r.productId, -r.qty);
      }

      // 4. Apply net stock changes
      for (const [productId, delta] of stockChanges) {
        if (delta === 0) continue;
        const product = products.find(p => p.id === productId);
        if (product) {
          const currentStock = parseInt(product.stock) || 0;
          const newStock = Math.max(0, currentStock + delta);
          try {
            await updateProduct.mutateAsync({
              id: product.id,
              data: { ...product, stock: newStock.toString() },
            });
          } catch (e) {
            await new Promise(r => setTimeout(r, 1000));
            await updateProduct.mutateAsync({
              id: product.id,
              data: { ...product, stock: newStock.toString() },
            });
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }

      toast({ title: editMode ? "แก้ไขรายการรับเข้าสำเร็จ" : "บันทึกรายการรับเข้าสำเร็จ" });
      if (editMode) {
        navigate("/stock-in-manage");
      } else {
        setInvoiceNo(""); setCompanyId(""); setItems([]);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <div className="space-y-6">
      {editMode && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between py-3">
            <div className="text-sm">
              <span className="font-medium">โหมดแก้ไข:</span> ใบส่งของ <span className="font-mono">{invoiceNo}</span>
              <span className="text-muted-foreground ml-2">(จะปรับสต็อกเฉพาะส่วนที่แก้ไขเท่านั้น)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="mr-1 h-4 w-4" />ยกเลิก
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            {editMode ? "แก้ไขรายการรับเข้า" : "รับเข้าวัสดุ"}
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
                    {date ? formatThaiBuddhistDate(date) : "เลือกวันที่"}
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
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {selectedProduct
                          ? (() => {
                              const p = products.find((pr) => pr.id === selectedProduct);
                              return p ? `${p.id} - ${p.name}` : "เลือกวัสดุ";
                            })()
                          : "เลือกวัสดุ"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
                      <CommandInput placeholder="พิมพ์รหัสหรือชื่อวัสดุ..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>ไม่พบวัสดุ</CommandEmpty>
                        <CommandGroup>
                          {products.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.id} ${p.name}`}
                              onSelect={() => {
                                setSelectedProduct(p.id);
                                if (p.price) setPrice(p.price);
                                setProductOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedProduct === p.id ? "opacity-100" : "opacity-0")} />
                              <span className="text-sm">{p.id} - {p.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                    <TableCell>{item.productId}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">
                      {editMode && item.recordId ? (
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const v = parseInt(e.target.value) || 0;
                            setItems(items.map(it => it.id === item.id ? { ...it, quantity: v } : it));
                          }}
                          className="w-24 ml-auto text-right"
                        />
                      ) : item.quantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{item.price.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{(item.quantity * item.price).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItemFull(item.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">ยอดรวมทั้งสิ้น: <span className="text-primary">{totalAmount.toLocaleString()} บาท</span></div>
            <Button onClick={handleSave} size="lg" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PackagePlus className="mr-2 h-4 w-4" />
              {editMode ? "บันทึกการแก้ไข" : "บันทึกรายการรับเข้า"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
