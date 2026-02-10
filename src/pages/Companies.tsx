import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, Loader2 } from "lucide-react";
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

interface Company { id: string; name: string; contact: string; address: string; }

export default function Companies() {
  const { data: companies = [], isLoading } = useSheetData<Company>("companies");
  const createMutation = useSheetCreate("companies");
  const updateMutation = useSheetUpdate("companies");
  const deleteMutation = useSheetDelete("companies");

  const [isOpen, setIsOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({ id: "", name: "", contact: "", address: "" });
  const { toast } = useToast();

  const handleOpenDialog = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setFormData(company);
    } else {
      setEditingCompany(null);
      setFormData({ id: `COM${String(companies.length + 1).padStart(3, "0")}`, name: "", contact: "", address: "" });
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อบริษัท" });
      return;
    }
    try {
      if (editingCompany) {
        await updateMutation.mutateAsync({ id: editingCompany.id, data: formData });
        toast({ title: "แก้ไขบริษัทสำเร็จ" });
      } else {
        await createMutation.mutateAsync(formData);
        toast({ title: "เพิ่มบริษัทสำเร็จ" });
      }
      setIsOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "ลบบริษัทสำเร็จ" });
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
            <Building2 className="h-5 w-5" />
            บริษัท/ผู้ขาย
          </CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มบริษัท
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingCompany ? "แก้ไขบริษัท" : "เพิ่มบริษัทใหม่"}</DialogTitle>
                <DialogDescription>กรอกข้อมูลบริษัท/ผู้ขาย</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">รหัส</Label>
                  <Input value={formData.id} disabled className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ชื่อบริษัท</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">เบอร์ติดต่อ</Label>
                  <Input value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ที่อยู่</Label>
                  <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="col-span-3" />
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
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อบริษัท</TableHead>
                    <TableHead>เบอร์ติดต่อ</TableHead>
                    <TableHead>ที่อยู่</TableHead>
                    <TableHead className="text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">ไม่มีข้อมูล</TableCell></TableRow>
                  ) : companies.map((company) => (
                    <TableRow key={company.id} className="table-row-hover">
                      <TableCell className="font-medium">{company.id}</TableCell>
                      <TableCell>{company.name}</TableCell>
                      <TableCell>{company.contact}</TableCell>
                      <TableCell>{company.address}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(company)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(company.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
