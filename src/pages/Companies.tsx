import { useState } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
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

const mockCompanies = [
  { id: "COM001", name: "บริษัท ABC จำกัด", contact: "02-123-4567", address: "กรุงเทพมหานคร" },
  { id: "COM002", name: "บริษัท XYZ จำกัด", contact: "02-234-5678", address: "นนทบุรี" },
  { id: "COM003", name: "ห้างหุ้นส่วนจำกัด สำนักงาน", contact: "02-345-6789", address: "ปทุมธานี" },
];

export default function Companies() {
  const [companies, setCompanies] = useState(mockCompanies);
  const [isOpen, setIsOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<typeof mockCompanies[0] | null>(null);
  const [formData, setFormData] = useState({ id: "", name: "", contact: "", address: "" });
  const { toast } = useToast();

  const handleOpenDialog = (company?: typeof mockCompanies[0]) => {
    if (company) {
      setEditingCompany(company);
      setFormData(company);
    } else {
      setEditingCompany(null);
      setFormData({
        id: `COM${String(companies.length + 1).padStart(3, "0")}`,
        name: "",
        contact: "",
        address: "",
      });
    }
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อบริษัท" });
      return;
    }

    if (editingCompany) {
      setCompanies(companies.map((c) => (c.id === editingCompany.id ? formData : c)));
      toast({ title: "แก้ไขบริษัทสำเร็จ" });
    } else {
      setCompanies([...companies, formData]);
      toast({ title: "เพิ่มบริษัทสำเร็จ" });
    }
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    setCompanies(companies.filter((c) => c.id !== id));
    toast({ title: "ลบบริษัทสำเร็จ" });
  };

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
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">เบอร์ติดต่อ</Label>
                  <Input
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">ที่อยู่</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อบริษัท</TableHead>
                  <TableHead>เบอร์ติดต่อ</TableHead>
                  <TableHead>ที่อยู่</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} className="table-row-hover">
                    <TableCell className="font-medium">{company.id}</TableCell>
                    <TableCell>{company.name}</TableCell>
                    <TableCell>{company.contact}</TableCell>
                    <TableCell>{company.address}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(company)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(company.id)}
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
