import { useState, useMemo } from "react";
import { ClipboardList, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useSheetData, useSheetUpdate, useSheetDelete } from "@/hooks/useGoogleSheets";

interface StockInRecord {
  id: string;
  date: string;
  invoice_no: string;
  company_id: string;
  product_id: string;
  quantity: string;
  created_at: string;
}

interface Product { id: string; name: string; unit_id: string; stock: string; }
interface Company { id: string; name: string; }
interface Unit { id: string; name: string; }

export default function StockInManagement() {
  const { data: stockIns = [], isLoading } = useSheetData<StockInRecord>("stock_in");
  const { data: products = [] } = useSheetData<Product>("products");
  const { data: companies = [] } = useSheetData<Company>("companies");
  const { data: units = [] } = useSheetData<Unit>("units");

  const updateStockIn = useSheetUpdate("stock_in");
  const deleteStockIn = useSheetDelete("stock_in");
  const updateProduct = useSheetUpdate("products");

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editItem, setEditItem] = useState<StockInRecord | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [deleteItem, setDeleteItem] = useState<StockInRecord | null>(null);
  const { toast } = useToast();

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;
  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || id;
  const getProduct = (id: string) => products.find(p => p.id === id);
  const getUnitName = (unitId: string) => units.find(u => u.id === unitId)?.name || unitId;

  const filteredRecords = useMemo(() => {
    const q = search.toLowerCase();
    return stockIns.filter(r => {
      if (search && !(
        r.invoice_no?.toLowerCase().includes(q) ||
        getProductName(r.product_id).toLowerCase().includes(q) ||
        getCompanyName(r.company_id).toLowerCase().includes(q)
      )) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    }).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [stockIns, search, dateFrom, dateTo, products, companies]);

  // Group by invoice_no
  const grouped = useMemo(() => {
    const map = new Map<string, StockInRecord[]>();
    filteredRecords.forEach(r => {
      const key = r.invoice_no || r.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const dateA = a[1][0]?.created_at || "";
      const dateB = b[1][0]?.created_at || "";
      return dateB.localeCompare(dateA);
    });
  }, [filteredRecords]);

  const handleEdit = async () => {
    if (!editItem || !editQuantity) return;
    try {
      // Adjust product stock: remove old qty, add new qty
      const product = getProduct(editItem.product_id);
      if (product) {
        const currentStock = parseInt(product.stock) || 0;
        const oldQty = parseInt(editItem.quantity) || 0;
        const newQty = parseInt(editQuantity) || 0;
        const adjustedStock = currentStock - oldQty + newQty;
        await updateProduct.mutateAsync({
          id: product.id,
          data: { ...product, stock: Math.max(0, adjustedStock).toString() },
        });
      }

      await updateStockIn.mutateAsync({
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
      // Deduct stock for deleted record
      const product = getProduct(deleteItem.product_id);
      if (product) {
        const currentStock = parseInt(product.stock) || 0;
        const qty = parseInt(deleteItem.quantity) || 0;
        await updateProduct.mutateAsync({
          id: product.id,
          data: { ...product, stock: Math.max(0, currentStock - qty).toString() },
        });
      }

      await deleteStockIn.mutateAsync(deleteItem.id);
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
            จัดการรายการรับเข้า
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเลขที่ใบส่งของ, สินค้า, บริษัท..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {grouped.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">ไม่มีรายการรับเข้า</div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([invNo, records]) => {
                const first = records[0];
                return (
                  <Card key={invNo} className="border">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">ใบส่งของ: {invNo}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatDate(first.date)}</span>
                          <span>•</span>
                          <span>{getCompanyName(first.company_id)}</span>
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
                            <TableHead className="text-center">จัดการ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {records.map(record => {
                            const product = getProduct(record.product_id);
                            return (
                              <TableRow key={record.id}>
                                <TableCell>{getProductName(record.product_id)}</TableCell>
                                <TableCell>{product ? getUnitName(product.unit_id) : "-"}</TableCell>
                                <TableCell className="text-right">{parseInt(record.quantity).toLocaleString()}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                      onClick={() => { setEditItem(record); setEditQuantity(record.quantity); }}
                                      title="แก้ไข">
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

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขรายการรับเข้า</DialogTitle>
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
            <Button onClick={handleEdit} disabled={updateStockIn.isPending}>
              {updateStockIn.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              <span className="block mt-1 text-destructive font-medium">
                การลบจะหักสต็อกสินค้าอัตโนมัติ
              </span>
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
