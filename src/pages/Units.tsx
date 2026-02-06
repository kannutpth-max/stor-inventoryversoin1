import { useState } from "react";
import { Plus, Pencil, Trash2, Ruler } from "lucide-react";
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

const mockUnits = [
  { id: "U001", name: "ชิ้น" },
  { id: "U002", name: "อัน" },
  { id: "U003", name: "แพ็ค" },
  { id: "U004", name: "กล่อง" },
  { id: "U005", name: "รีม" },
  { id: "U006", name: "ตลับ" },
  { id: "U007", name: "ม้วน" },
];

export default function Units() {
  const [units, setUnits] = useState(mockUnits);
  const [isOpen, setIsOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<typeof mockUnits[0] | null>(null);
  const [formData, setFormData] = useState({ id: "", name: "" });
  const { toast } = useToast();

  const handleOpenDialog = (unit?: typeof mockUnits[0]) => {
    if (unit) {
      setEditingUnit(unit);
      setFormData({ id: unit.id, name: unit.name });
    } else {
      setEditingUnit(null);
      setFormData({ id: `U${String(units.length + 1).padStart(3, "0")}`, name: "" });
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อหน่วย" });
      return;
    }

    if (editingUnit) {
      setUnits(units.map((u) => (u.id === editingUnit.id ? formData : u)));
      toast({ title: "แก้ไขหน่วยสำเร็จ" });
    } else {
      setUnits([...units, formData]);
      toast({ title: "เพิ่มหน่วยสำเร็จ" });
    }
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    setUnits(units.filter((u) => u.id !== id));
    toast({ title: "ลบหน่วยสำเร็จ" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            หน่วยนับ
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มหน่วย
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>{editingUnit ? "แก้ไขหน่วย" : "เพิ่มหน่วยใหม่"}</DialogTitle>
                <DialogDescription>กรอกข้อมูลหน่วยนับ</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">รหัส</Label>
                  <Input value={formData.id} disabled className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ชื่อหน่วย</Label>
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
                  <TableHead>รหัสหน่วย</TableHead>
                  <TableHead>ชื่อหน่วย</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id} className="table-row-hover">
                    <TableCell className="font-medium">{unit.id}</TableCell>
                    <TableCell>{unit.name}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(unit)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(unit.id)}
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
