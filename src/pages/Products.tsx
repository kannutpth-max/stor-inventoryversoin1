import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Package, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSheetData, useSheetCreate, useSheetUpdate, useSheetDelete } from "@/hooks/useGoogleSheets";

interface Product {
  id: string; name: string; category_id: string; unit_id: string;
  price: string; min_stock: string; stock: string; image: string;
}
interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }

export default function Products() {
  const { data: products = [], isLoading } = useSheetData<Product>("products");
  const { data: categories = [] } = useSheetData<Category>("categories");
  const { data: units = [] } = useSheetData<Unit>("units");
  const createMutation = useSheetCreate("products");
  const updateMutation = useSheetUpdate("products");
  const deleteMutation = useSheetDelete("products");

  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ id: "", name: "", category_id: "", unit_id: "", price: "", min_stock: "", stock: "", image: "" });
  const { toast } = useToast();

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || id;
  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || id;

  const filteredProducts = products.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ ...product });
    } else {
      setEditingProduct(null);
      setFormData({ id: `P${String(products.length + 1).padStart(3, "0")}`, name: "", category_id: "", unit_id: "", price: "", min_stock: "", stock: "0", image: "" });
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.category_id || !formData.unit_id) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }
    try {
      if (editingProduct) {
        await updateMutation.mutateAsync({ id: editingProduct.id, data: formData });
        toast({ title: "แก้ไขสินค้าสำเร็จ" });
      } else {
        await createMutation.mutateAsync(formData);
        toast({ title: "เพิ่มสินค้าสำเร็จ" });
      }
      setIsOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "ลบสินค้าสำเร็จ" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

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
                <DialogTitle>{editingProduct ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</DialogTitle>
                <DialogDescription>กรอกข้อมูลสินค้าให้ครบถ้วน</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">รหัสสินค้า</Label>
                  <Input value={formData.id} className="col-span-3" disabled={!!editingProduct}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ชื่อสินค้า</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ประเภท</Label>
                  <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                    <SelectTrigger className="col-span-3"><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">หน่วย</Label>
                  <Select value={formData.unit_id} onValueChange={(v) => setFormData({ ...formData, unit_id: v })}>
                    <SelectTrigger className="col-span-3"><SelectValue placeholder="เลือกหน่วย" /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ราคา (บาท)</Label>
                  <Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">เกณฑ์ขั้นต่ำ</Label>
                  <Input type="number" value={formData.min_stock} onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">รูปภาพ (URL)</Label>
                  <Input value={formData.image} onChange={(e) => setFormData({ ...formData, image: e.target.value })} className="col-span-3" placeholder="https://example.com/image.jpg" />
                </div>
                {formData.image && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-start-2 col-span-3">
                      <img src={formData.image} alt="Preview" className="h-20 w-20 object-cover rounded-md border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  บันทึก
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ค้นหาสินค้า..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 max-w-sm" />
            </div>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">รูป</TableHead>
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
                  {filteredProducts.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">ไม่มีข้อมูล</TableCell></TableRow>
                  ) : filteredProducts.map((product) => {
                    const stock = parseInt(product.stock) || 0;
                    const minStock = parseInt(product.min_stock) || 0;
                    return (
                      <TableRow key={product.id} className="table-row-hover">
                        <TableCell>
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="h-10 w-10 object-cover rounded-md border" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                          ) : (
                            <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{product.id}</TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{getCategoryName(product.category_id)}</TableCell>
                        <TableCell>{getUnitName(product.unit_id)}</TableCell>
                        <TableCell className="text-right">{parseFloat(product.price || "0").toLocaleString()}</TableCell>
                        <TableCell className="text-right">{stock.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{minStock.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          {stock < minStock ? (
                            <Badge variant="destructive">ต่ำกว่าเกณฑ์</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-success/10 text-success border-success/20">ปกติ</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(product)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
