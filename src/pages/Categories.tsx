import { useState } from "react";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const mockCategories = [
  { id: "C001", name: "เครื่องเขียน" },
  { id: "C002", name: "อุปกรณ์สำนักงาน" },
  { id: "C003", name: "อุปกรณ์คอมพิวเตอร์" },
  { id: "C004", name: "อุปกรณ์ทำความสะอาด" },
];

export default function Categories() {
  const [categories, setCategories] = useState(mockCategories);
  const [isOpen, setIsOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<typeof mockCategories[0] | null>(null);
  const [formData, setFormData] = useState({ id: "", name: "" });
  const { toast } = useToast();

  const handleOpenDialog = (category?: typeof mockCategories[0]) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ id: category.id, name: category.name });
    } else {
      setEditingCategory(null);
      setFormData({ id: `C${String(categories.length + 1).padStart(3, "0")}`, name: "" });
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อประเภท" });
      return;
    }

    if (editingCategory) {
      setCategories(categories.map((c) => (c.id === editingCategory.id ? formData : c)));
      toast({ title: "แก้ไขประเภทสำเร็จ" });
    } else {
      setCategories([...categories, formData]);
      toast({ title: "เพิ่มประเภทสำเร็จ" });
    }
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id));
    toast({ title: "ลบประเภทสำเร็จ" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            ประเภทสินค้า
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มประเภท
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>{editingCategory ? "แก้ไขประเภท" : "เพิ่มประเภทใหม่"}</DialogTitle>
                <DialogDescription>กรอกข้อมูลประเภทสินค้า</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">รหัส</Label>
                  <Input value={formData.id} disabled className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ชื่อประเภท</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleSave}>บันทึก</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสประเภท</TableHead>
                  <TableHead>ชื่อประเภท</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id} className="table-row-hover">
                    <TableCell className="font-medium">{category.id}</TableCell>
                    <TableCell>{category.name}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(category)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(category.id)}
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
