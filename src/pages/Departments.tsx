import { useState } from "react";
import { Plus, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSheetData, useSheetCreate, useSheetUpdate, useSheetDelete } from "@/hooks/useGoogleSheets";

interface Department { id: string; name: string; }

export default function Departments() {
  const { data: departments = [], isLoading } = useSheetData<Department>("departments");
  const createMutation = useSheetCreate("departments");
  const updateMutation = useSheetUpdate("departments");
  const deleteMutation = useSheetDelete("departments");

  const [isOpen, setIsOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ id: "", name: "" });
  const { toast } = useToast();

  const handleOpenDialog = (department?: Department) => {
    if (department) {
      setEditingDepartment(department);
      setFormData({ id: department.id, name: department.name });
    } else {
      setEditingDepartment(null);
      setFormData({ id: `D${String(departments.length + 1).padStart(3, "0")}`, name: "" });
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อหน่วยงาน" });
      return;
    }
    try {
      if (editingDepartment) {
        await updateMutation.mutateAsync({ id: editingDepartment.id, data: formData });
        toast({ title: "แก้ไขหน่วยงานสำเร็จ" });
      } else {
        await createMutation.mutateAsync(formData);
        toast({ title: "เพิ่มหน่วยงานสำเร็จ" });
      }
      setIsOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "ลบหน่วยงานสำเร็จ" });
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
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="col-span-3" />
                </div>
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
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
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
                  {departments.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">ไม่มีข้อมูล</TableCell></TableRow>
                  ) : departments.map((dept) => (
                    <TableRow key={dept.id} className="table-row-hover">
                      <TableCell className="font-medium">{dept.id}</TableCell>
                      <TableCell>{dept.name}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(dept)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
