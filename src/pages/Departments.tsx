import { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
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

const mockDepartments = [
  { id: "D001", name: "ฝ่ายบุคคล" },
  { id: "D002", name: "ฝ่ายบัญชี" },
  { id: "D003", name: "ฝ่ายธุรการ" },
  { id: "D004", name: "ฝ่ายไอที" },
  { id: "D005", name: "ฝ่ายจัดซื้อ" },
];

export default function Departments() {
  const [departments, setDepartments] = useState(mockDepartments);
  const [isOpen, setIsOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<typeof mockDepartments[0] | null>(null);
  const [formData, setFormData] = useState({ id: "", name: "" });
  const { toast } = useToast();

  const handleOpenDialog = (department?: typeof mockDepartments[0]) => {
    if (department) {
      setEditingDepartment(department);
      setFormData({ id: department.id, name: department.name });
    } else {
      setEditingDepartment(null);
      setFormData({ id: `D${String(departments.length + 1).padStart(3, "0")}`, name: "" });
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อหน่วยงาน" });
      return;
    }

    if (editingDepartment) {
      setDepartments(departments.map((d) => (d.id === editingDepartment.id ? formData : d)));
      toast({ title: "แก้ไขหน่วยงานสำเร็จ" });
    } else {
      setDepartments([...departments, formData]);
      toast({ title: "เพิ่มหน่วยงานสำเร็จ" });
    }
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    setDepartments(departments.filter((d) => d.id !== id));
    toast({ title: "ลบหน่วยงานสำเร็จ" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            หน่วยงานเบิก
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มหน่วยงาน
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>{editingDepartment ? "แก้ไขหน่วยงาน" : "เพิ่มหน่วยงานใหม่"}</DialogTitle>
                <DialogDescription>กรอกข้อมูลหน่วยงานเบิก</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">รหัส</Label>
                  <Input value={formData.id} disabled className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ชื่อหน่วยงาน</Label>
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
                  <TableHead>รหัสหน่วยงาน</TableHead>
                  <TableHead>ชื่อหน่วยงาน</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <TableRow key={department.id} className="table-row-hover">
                    <TableCell className="font-medium">{department.id}</TableCell>
                    <TableCell>{department.name}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(department)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(department.id)}
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
