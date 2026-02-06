import { useState } from "react";
import { Plus, Trash2, PackageMinus, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const mockDepartments = [
  { id: "D001", name: "ฝ่ายบุคคล" },
  { id: "D002", name: "ฝ่ายบัญชี" },
  { id: "D003", name: "ฝ่ายธุรการ" },
  { id: "D004", name: "ฝ่ายไอที" },
];

const mockProducts = [
  { id: "P001", name: "กระดาษ A4", unit: "รีม", stock: 250 },
  { id: "P002", name: "ปากกาลูกลื่น", unit: "แพ็ค", stock: 20 },
  { id: "P003", name: "หมึกพิมพ์ HP", unit: "ตลับ", stock: 5 },
  { id: "P004", name: "แฟ้มเอกสาร", unit: "อัน", stock: 150 },
];

interface StockOutItem {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  stock: number;
}

export default function StockOut() {
  const [date, setDate] = useState<Date>(new Date());
  const [withdrawNo, setWithdrawNo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [items, setItems] = useState<StockOutItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const { toast } = useToast();

  const handleAddItem = () => {
    if (!selectedProduct || !quantity) {
      toast({ variant: "destructive", title: "กรุณาเลือกสินค้าและระบุจำนวน" });
      return;
    }

    const product = mockProducts.find((p) => p.id === selectedProduct);
    if (!product) return;

    const qty = parseInt(quantity);
    if (qty > product.stock) {
      toast({ variant: "destructive", title: "จำนวนเกินกว่าสินค้าคงเหลือ" });
      return;
    }

    const newItem: StockOutItem = {
      id: `item-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity: qty,
      stock: product.stock,
    };

    setItems([...items, newItem]);
    setSelectedProduct("");
    setQuantity("");
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    if (!date || !withdrawNo || !departmentId || items.length === 0) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }

    toast({ title: "บันทึกรายการเบิกสำเร็จ" });
    // Reset form
    setWithdrawNo("");
    setDepartmentId("");
    setItems([]);
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
          {/* Header Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>วันที่เบิก</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: th }) : "เลือกวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>เลขที่ใบเบิก</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={withdrawNo}
                  onChange={(e) => setWithdrawNo(e.target.value)}
                  placeholder="WD-XXXX"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>หน่วยงานเบิก</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกหน่วยงาน" />
                </SelectTrigger>
                <SelectContent>
                  {mockDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Add Item Form */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <h3 className="font-medium mb-4">เพิ่มรายการเบิก</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสินค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} (คงเหลือ: {product.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="จำนวน"
                />
              </div>
              <div>
                <Button onClick={handleAddItem} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  เพิ่ม
                </Button>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสสินค้า</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead>หน่วย</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                  <TableHead className="text-right">จำนวนเบิก</TableHead>
                  <TableHead className="text-center">ลบ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      ยังไม่มีรายการเบิก
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productId}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{item.stock.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-accent">
                        -{item.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">
              รวมจำนวนเบิก: <span className="text-accent">{totalItems.toLocaleString()} รายการ</span>
            </div>
            <Button onClick={handleSave} size="lg">
              <PackageMinus className="mr-2 h-4 w-4" />
              บันทึกรายการเบิก
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
