import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Mock data
const mockProducts = [
  { id: "P001", name: "กระดาษ A4", category: "เครื่องเขียน", unit: "รีม", price: 150, minStock: 100, currentStock: 250 },
  { id: "P002", name: "ปากกาลูกลื่น", category: "เครื่องเขียน", unit: "แพ็ค", price: 45, minStock: 50, currentStock: 20 },
  { id: "P003", name: "หมึกพิมพ์ HP", category: "อุปกรณ์สำนักงาน", unit: "ตลับ", price: 890, minStock: 10, currentStock: 5 },
  { id: "P004", name: "แฟ้มเอกสาร", category: "เครื่องเขียน", unit: "อัน", price: 25, minStock: 30, currentStock: 150 },
  { id: "P005", name: "คลิปหนีบกระดาษ", category: "เครื่องเขียน", unit: "กล่อง", price: 15, minStock: 20, currentStock: 45 },
];

const mockCategories = ["เครื่องเขียน", "อุปกรณ์สำนักงาน", "อุปกรณ์คอมพิวเตอร์", "อื่นๆ"];
const mockUnits = ["ชิ้น", "อัน", "แพ็ค", "กล่อง", "รีม", "ตลับ", "ม้วน"];

export default function Products() {
  const [products, setProducts] = useState(mockProducts);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<typeof mockProducts[0] | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    category: "",
    unit: "",
    price: "",
    minStock: "",
  });
  const { toast } = useToast();

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDialog = (product?: typeof mockProducts[0]) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        id: product.id,
        name: product.name,
        category: product.category,
        unit: product.unit,
        price: product.price.toString(),
        minStock: product.minStock.toString(),
      });
    } else {
      setEditingProduct(null);
      setFormData({
        id: `P${String(products.length + 1).padStart(3, "0")}`,
        name: "",
        category: "",
        unit: "",
        price: "",
        minStock: "",
      });
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.category || !formData.unit) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลให้ครบถ้วน",
      });
      return;
    }

    if (editingProduct) {
      setProducts(
        products.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name: formData.name,
                category: formData.category,
                unit: formData.unit,
                price: parseFloat(formData.price) || 0,
                minStock: parseInt(formData.minStock) || 0,
              }
            : p
        )
      );
      toast({
        title: "แก้ไขสินค้าสำเร็จ",
        description: `สินค้า ${formData.name} ได้รับการแก้ไขแล้ว`,
      });
    } else {
      setProducts([
        ...products,
        {
          id: formData.id,
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          price: parseFloat(formData.price) || 0,
          minStock: parseInt(formData.minStock) || 0,
          currentStock: 0,
        },
      ]);
      toast({
        title: "เพิ่มสินค้าสำเร็จ",
        description: `สินค้า ${formData.name} ถูกเพิ่มเข้าระบบแล้ว`,
      });
    }
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    setProducts(products.filter((p) => p.id !== id));
    toast({
      title: "ลบสินค้าสำเร็จ",
      description: "สินค้าถูกลบออกจากระบบแล้ว",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            ข้อมูลสินค้า
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มสินค้า
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
                </DialogTitle>
                <DialogDescription>
                  กรอกข้อมูลสินค้าให้ครบถ้วน
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">รหัสสินค้า</Label>
                  <Input
                    value={formData.id}
                    onChange={(e) =>
                      setFormData({ ...formData, id: e.target.value })
                    }
                    className="col-span-3"
                    disabled={!!editingProduct}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ชื่อสินค้า</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ประเภท</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="เลือกประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">หน่วย</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, unit: value })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="เลือกหน่วย" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ราคา (บาท)</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">เกณฑ์ขั้นต่ำ</Label>
                  <Input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) =>
                      setFormData({ ...formData, minStock: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleSave}>บันทึก</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาสินค้า..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 max-w-sm"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อสินค้า</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>หน่วย</TableHead>
                  <TableHead className="text-right">ราคา</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                  <TableHead className="text-right">เกณฑ์ขั้นต่ำ</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className="table-row-hover">
                    <TableCell className="font-medium">{product.id}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell className="text-right">
                      {product.price.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.currentStock.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.minStock.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {product.currentStock < product.minStock ? (
                        <Badge variant="destructive">ต่ำกว่าเกณฑ์</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                          ปกติ
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
