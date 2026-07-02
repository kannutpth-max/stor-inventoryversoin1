import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { parseSheetDate } from "@/lib/utils";
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

export default function StockInManagement() {
  const navigate = useNavigate();
  const { data: stockIns = [], isLoading } = useSheetData<StockInRecord>("stock_in");
  const { data: products = [] } = useSheetData<Product>("products");
  const { data: companies = [] } = useSheetData<Company>("companies");

  const deleteStockIn = useSheetDelete("stock_in");
  const updateProduct = useSheetUpdate("products");

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteInvoice, setDeleteInvoice] = useState<{ invNo: string; records: StockInRecord[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;
  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || id;
  const getProduct = (id: string) => products.find(p => p.id === id);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = stockIns.filter(r => {
      if (search && !(
        r.invoice_no?.toLowerCase().includes(q) ||
        getProductName(r.product_id).toLowerCase().includes(q) ||
        getCompanyName(r.company_id).toLowerCase().includes(q)
      )) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });
    const map = new Map<string, StockInRecord[]>();
    filtered.forEach(r => {
      const key = r.invoice_no || r.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const dateA = a[1][0]?.created_at || a[1][0]?.date || "";
      const dateB = b[1][0]?.created_at || b[1][0]?.date || "";
      return dateB.localeCompare(dateA);
    });
  }, [stockIns, search, dateFrom, dateTo, products, companies]);

  const handleEditInvoice = (invNo: string, records: StockInRecord[]) => {
    navigate("/stock-in", { state: { editInvoice: invNo, records } });
  };

  const handleDeleteInvoice = async () => {
    if (!deleteInvoice) return;
    setDeleting(true);
    try {
      // aggregate stock to deduct
      const stockChanges = new Map<string, number>();
      for (const r of deleteInvoice.records) {
        const qty = parseInt(r.quantity) || 0;
        stockChanges.set(r.product_id, (stockChanges.get(r.product_id) || 0) + qty);
      }
      // deduct stock
      for (const [productId, qty] of stockChanges) {
        const product = getProduct(productId);
        if (product) {
          const currentStock = parseInt(product.stock) || 0;
          await updateProduct.mutateAsync({
            id: product.id,
            data: { ...product, stock: Math.max(0, currentStock - qty).toString() },
          });
          await new Promise(r => setTimeout(r, 300));
        }
      }
      // delete records
      for (const r of deleteInvoice.records) {
        await deleteStockIn.mutateAsync(r.id);
        await new Promise(r => setTimeout(r, 200));
      }
      toast({ title: "ลบใบส่งของสำเร็จ" });
      setDeleteInvoice(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try { return format(parseSheetDate(dateStr), "d MMM yyyy", { locale: th }); }
    catch { return dateStr; }
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
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาเลขที่ใบส่งของ, วัสดุ, บริษัท..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">จากวันที่</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[170px]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">ถึงวันที่</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[170px]" />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                ล้างวันที่
              </Button>
            )}
          </div>

          {grouped.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">ไม่มีรายการรับเข้า</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>เลขที่ใบส่งของ</TableHead>
                    <TableHead>บริษัท</TableHead>
                    <TableHead className="text-right">จำนวนรายการ</TableHead>
                    <TableHead className="text-right">รวมจำนวน</TableHead>
                    <TableHead className="text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.map(([invNo, records]) => {
                    const first = records[0];
                    const totalQty = records.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0);
                    return (
                      <TableRow key={invNo}>
                        <TableCell>{formatDate(first.date)}</TableCell>
                        <TableCell className="font-medium">{invNo}</TableCell>
                        <TableCell>{getCompanyName(first.company_id)}</TableCell>
                        <TableCell className="text-right">{records.length}</TableCell>
                        <TableCell className="text-right">{totalQty.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => handleEditInvoice(invNo, records)} title="แก้ไข">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteInvoice({ invNo, records })} title="ลบ">
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      <AlertDialog open={!!deleteInvoice} onOpenChange={(o) => !o && setDeleteInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบใบส่งของ</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบใบส่งของ {deleteInvoice?.invNo} ({deleteInvoice?.records.length} รายการ) ?
              <span className="block mt-1 text-destructive font-medium">
                การลบจะหักสต็อกวัสดุทั้งหมดของใบส่งของนี้อัตโนมัติ
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDeleteInvoice(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
