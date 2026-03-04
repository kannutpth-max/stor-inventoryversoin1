import { useState, useMemo } from "react";
import { ClipboardList, Check, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useSheetData, useSheetUpdate, useSheetDelete } from "@/hooks/useGoogleSheets";

interface StockOutRecord {
  id: string;
  date: string;
  requisition_no: string;
  department_id: string;
  product_id: string;
  quantity: string;
  status?: string;
  created_at: string;
}

interface Product { id: string; name: string; unit_id: string; stock: string; }
interface Department { id: string; name: string; }
interface Unit { id: string; name: string; }

export default function StockOutManagement() {
  const { data: stockOuts = [], isLoading } = useSheetData<StockOutRecord>("stock_out");
  const { data: products = [] } = useSheetData<Product>("products");
  const { data: departments = [] } = useSheetData<Department>("departments");
  const { data: units = [] } = useSheetData<Unit>("units");

  const updateStockOut = useSheetUpdate("stock_out");
  const deleteStockOut = useSheetDelete("stock_out");
  const updateProduct = useSheetUpdate("products");

  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<StockOutRecord | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [deleteItem, setDeleteItem] = useState<StockOutRecord | null>(null);
  const [dispenseItem, setDispenseItem] = useState<StockOutRecord | null>(null);
  const { toast } = useToast();

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || id;
  const getProduct = (id: string) => products.find(p => p.id === id);
  const getUnitName = (unitId: string) => units.find(u => u.id === unitId)?.name || unitId;

  const filteredRecords = useMemo(() => {
    if (!search) return stockOuts;
    const q = search.toLowerCase();
    return stockOuts.filter(r =>
      r.requisition_no?.toLowerCase().includes(q) ||
      getProductName(r.product_id).toLowerCase().includes(q) ||
      getDepartmentName(r.department_id).toLowerCase().includes(q)
    );
  }, [stockOuts, search, products, departments]);

  // Group by requisition_no
  const grouped = useMemo(() => {
    const map = new Map<string, StockOutRecord[]>();
    filteredRecords.forEach(r => {
      const key = r.requisition_no || r.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const dateA = a[1][0]?.created_at || "";
      const dateB = b[1][0]?.created_at || "";
      return dateB.localeCompare(dateA);
    });
  }, [filteredRecords]);

  const handleDispense = async (record: StockOutRecord) => {
    try {
      const product = getProduct(record.product_id);
      if (!product) {
        toast({ variant: "destructive", title: "ไม่พบข้อมูลสินค้า" });
        return;
      }
      const currentStock = parseInt(product.stock) || 0;
      const qty = parseInt(record.quantity) || 0;
      if (qty > currentStock) {
        toast({ variant: "destructive", title: "สินค้าคงเหลือไม่เพียงพอ", description: `คงเหลือ ${currentStock} แต่ต้องการจ่าย ${qty}` });
        return;
      }

      // Update stock
      await updateProduct.mutateAsync({
        id: product.id,
        data: { ...product, stock: (currentStock - qty).toString() },
      });

      // Mark as dispensed
      await updateStockOut.mutateAsync({
        id: record.id,
        data: { ...record, status: "dispensed" },
      });

      toast({ title: "จ่ายสินค้าและตัดสต็อกสำเร็จ" });
      setDispenseItem(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const handleDispenseAll = async (records: StockOutRecord[]) => {
    const pending = records.filter(r => r.status !== "dispensed");
    if (pending.length === 0) {
      toast({ title: "รายการทั้งหมดถูกจ่ายแล้ว" });
      return;
    }
    try {
      for (const record of pending) {
        const product = getProduct(record.product_id);
        if (!product) continue;
        const currentStock = parseInt(product.stock) || 0;
        const qty = parseInt(record.quantity) || 0;
        if (qty > currentStock) {
          toast({ variant: "destructive", title: `สินค้า ${getProductName(record.product_id)} คงเหลือไม่เพียงพอ` });
          return;
        }
        await updateProduct.mutateAsync({
          id: product.id,
          data: { ...product, stock: (currentStock - qty).toString() },
        });
        await updateStockOut.mutateAsync({
          id: record.id,
          data: { ...record, status: "dispensed" },
        });
      }
      toast({ title: "จ่ายสินค้าทั้งใบเบิกสำเร็จ" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const handleEdit = async () => {
    if (!editItem || !editQuantity) return;
    try {
      await updateStockOut.mutateAsync({
        id: editItem.id,
        data: { ...editItem, quantity: editQuantity },
      });
      toast({ title: "แก้ไขรายการสำเร็จ" });
      setEditItem(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      // If already dispensed, restore stock
      if (deleteItem.status === "dispensed") {
        const product = getProduct(deleteItem.product_id);
        if (product) {
          const currentStock = parseInt(product.stock) || 0;
          const qty = parseInt(deleteItem.quantity) || 0;
          await updateProduct.mutateAsync({
            id: product.id,
            data: { ...product, stock: (currentStock + qty).toString() },
          });
        }
      }
      await deleteStockOut.mutateAsync(deleteItem.id);
      toast({ title: "ลบรายการสำเร็จ" });
      setDeleteItem(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: th });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            จัดการรายการเบิก
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเลขที่ใบเบิก, สินค้า, หน่วยงาน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {grouped.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">ไม่มีรายการเบิก</div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([reqNo, records]) => {
                const first = records[0];
                const allDispensed = records.every(r => r.status === "dispensed");
                const someDispensed = records.some(r => r.status === "dispensed");
                return (
                  <Card key={reqNo} className="border">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base">ใบเบิก: {reqNo}</CardTitle>
                          <Badge variant={allDispensed ? "default" : someDispensed ? "secondary" : "outline"}>
                            {allDispensed ? "จ่ายแล้ว" : someDispensed ? "จ่ายบางส่วน" : "รอจ่าย"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatDate(first.date)}</span>
                          <span>•</span>
                          <span>{getDepartmentName(first.department_id)}</span>
                          {!allDispensed && (
                            <Button size="sm" variant="default" className="ml-2" onClick={() => handleDispenseAll(records)}
                              disabled={updateStockOut.isPending || updateProduct.isPending}>
                              <Check className="mr-1 h-3 w-3" />
                              จ่ายทั้งใบ
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>สินค้า</TableHead>
                            <TableHead>หน่วย</TableHead>
                            <TableHead className="text-right">จำนวน</TableHead>
                            <TableHead className="text-center">สถานะ</TableHead>
                            <TableHead className="text-center">จัดการ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {records.map(record => {
                            const product = getProduct(record.product_id);
                            const isDispensed = record.status === "dispensed";
                            return (
                              <TableRow key={record.id}>
                                <TableCell>{getProductName(record.product_id)}</TableCell>
                                <TableCell>{product ? getUnitName(product.unit_id) : "-"}</TableCell>
                                <TableCell className="text-right">{parseInt(record.quantity).toLocaleString()}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={isDispensed ? "default" : "outline"} className="text-xs">
                                    {isDispensed ? "จ่ายแล้ว" : "รอจ่าย"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {!isDispensed && (
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary"
                                        onClick={() => setDispenseItem(record)}
                                        title="จ่ายสินค้า">
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                      onClick={() => { setEditItem(record); setEditQuantity(record.quantity); }}
                                      title="แก้ไข" disabled={isDispensed}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => setDeleteItem(record)} title="ลบ">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dispense confirmation */}
      <AlertDialog open={!!dispenseItem} onOpenChange={() => setDispenseItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการจ่ายสินค้า</AlertDialogTitle>
            <AlertDialogDescription>
              จ่าย {dispenseItem ? getProductName(dispenseItem.product_id) : ""} จำนวน {dispenseItem?.quantity} ชิ้น
              <br />การจ่ายจะตัดสต็อกสินค้าอัตโนมัติ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => dispenseItem && handleDispense(dispenseItem)}>
              ยืนยันจ่าย
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขรายการเบิก</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>สินค้า</Label>
              <Input value={editItem ? getProductName(editItem.product_id) : ""} disabled />
            </div>
            <div>
              <Label>จำนวน</Label>
              <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>ยกเลิก</Button>
            <Button onClick={handleEdit} disabled={updateStockOut.isPending}>
              {updateStockOut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบรายการ {deleteItem ? getProductName(deleteItem.product_id) : ""} ?
              {deleteItem?.status === "dispensed" && (
                <span className="block mt-1 text-destructive font-medium">
                  รายการนี้ถูกจ่ายแล้ว การลบจะคืนสต็อกอัตโนมัติ
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
