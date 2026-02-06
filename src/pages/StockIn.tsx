import { useState } from "react";
import { Plus, Trash2, PackagePlus, Calendar, FileText } from "lucide-react";
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

const mockCompanies = [
  { id: "COM001", name: "บริษัท ABC จำกัด" },
  { id: "COM002", name: "บริษัท XYZ จำกัด" },
  { id: "COM003", name: "ห้างหุ้นส่วนจำกัด สำนักงาน" },
];

const mockProducts = [
  { id: "P001", name: "กระดาษ A4", unit: "รีม" },
  { id: "P002", name: "ปากกาลูกลื่น", unit: "แพ็ค" },
  { id: "P003", name: "หมึกพิมพ์ HP", unit: "ตลับ" },
  { id: "P004", name: "แฟ้มเอกสาร", unit: "อัน" },
];

interface StockInItem {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  price: number;
}

export default function StockIn() {
  const [date, setDate] = useState<Date>(new Date());
  const [invoiceNo, setInvoiceNo] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<StockInItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const { toast } = useToast();

  const handleAddItem = () => {
    if (!selectedProduct || !quantity) {
      toast({ variant: "destructive", title: "กรุณาเลือกสินค้าและระบุจำนวน" });
      return;
    }

    const product = mockProducts.find((p) => p.id === selectedProduct);
    if (!product) return;

    const newItem: StockInItem = {
      id: `item-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity: parseInt(quantity),
      price: parseFloat(price) || 0,
    };

    setItems([...items, newItem]);
    setSelectedProduct("");
    setQuantity("");
    setPrice("");
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    if (!date || !invoiceNo || !companyId || items.length === 0) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }

    toast({ title: "บันทึกรายการรับเข้าสำเร็จ" });
    // Reset form
    setInvoiceNo("");
    setCompanyId("");
    setItems([]);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            รับเข้าสินค้า
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>วันที่รับเข้า</Label>
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
              <Label>เลขที่ใบส่งของ</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="INV-XXXX"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>จากบริษัท</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  {mockCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Add Item Form */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <h3 className="font-medium mb-4">เพิ่มรายการสินค้า</h3>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสินค้า" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
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
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="ราคา/หน่วย"
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
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead className="text-right">ราคา/หน่วย</TableHead>
                  <TableHead className="text-right">รวม</TableHead>
                  <TableHead className="text-center">ลบ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      ยังไม่มีรายการสินค้า
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productId}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.price.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">
                        {(item.quantity * item.price).toLocaleString()}
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
              ยอดรวมทั้งสิ้น: <span className="text-primary">{totalAmount.toLocaleString()} บาท</span>
            </div>
            <Button onClick={handleSave} size="lg">
              <PackagePlus className="mr-2 h-4 w-4" />
              บันทึกรายการรับเข้า
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
