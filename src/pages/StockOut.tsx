import { useState } from "react";
import { Plus, Trash2, PackageMinus, Calendar, FileText, Loader2 } from "lucide-react";
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
  const [items, setItems] = useState<StockOutItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const { toast } = useToast();

  const getUnitName = (unitId: string) => units.find(u => u.id === unitId)?.name || unitId;

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
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageMinus className="h-5 w-5" />
            เบิกสินค้า
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>วันที่เบิก</Label>
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
              <Label>เลขที่ใบเบิก</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={withdrawNo} onChange={(e) => setWithdrawNo(e.target.value)} placeholder="WD-XXXX" className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>หน่วยงานเบิก</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="เลือกหน่วยงาน" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-muted/30">
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสสินค้า</TableHead><TableHead>ชื่อสินค้า</TableHead><TableHead>หน่วย</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead><TableHead className="text-right">จำนวนเบิก</TableHead>
                  <TableHead className="text-center">ลบ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">ยังไม่มีรายการเบิก</TableCell></TableRow>
                ) : items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.productId}</TableCell><TableCell>{item.productName}</TableCell><TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.stock.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium text-accent">-{item.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">รวมจำนวนเบิก: <span className="text-accent">{totalItems.toLocaleString()} รายการ</span></div>
            <Button onClick={handleSave} size="lg" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PackageMinus className="mr-2 h-4 w-4" />
              บันทึกรายการเบิก
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
