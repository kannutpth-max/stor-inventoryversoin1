import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useSheetData, useSheetDelete, useSheetUpdate } from "@/hooks/useGoogleSheets";

interface StockOutRecord {
  id: string; date: string; requisition_no: string; department_id: string;
  product_id: string; quantity: string; status?: string; created_at: string;
}
interface Product { id: string; name: string; unit_id: string; stock: string; }
interface Department { id: string; name: string; }

export default function StockOutManagement() {
  const navigate = useNavigate();
  const { data: stockOuts = [], isLoading } = useSheetData<StockOutRecord>("stock_out");
  const { data: products = [] } = useSheetData<Product>("products");
  const { data: departments = [] } = useSheetData<Department>("departments");
  const deleteStockOut = useSheetDelete("stock_out");
  const updateProduct = useSheetUpdate("products");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteReqNo, setDeleteReqNo] = useState<string | null>(null);
  const { toast } = useToast();

  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || id;
  const getProduct = (id: string) => products.find(p => p.id === id);

  // Group by requisition_no
  const grouped = useMemo(() => {
    const map = new Map<string, StockOutRecord[]>();
    stockOuts.forEach(r => {
      const key = r.requisition_no || r.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    let entries = Array.from(map.entries()).sort((a, b) => {
      const dateA = a[1][0]?.created_at || "";
      const dateB = b[1][0]?.created_at || "";
      return dateB.localeCompare(dateA);
    });
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(([reqNo, records]) =>
        reqNo.toLowerCase().includes(q) ||
        getDepartmentName(records[0].department_id).toLowerCase().includes(q)
      );
    }
    if (dateFrom || dateTo) {
      entries = entries.filter(([, records]) => {
        const d = records[0]?.date || "";
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
    }
    return entries;
  }, [stockOuts, search, dateFrom, dateTo, departments]);

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), "d MMM yyyy", { locale: th }); }
    catch { return dateStr; }
  };

  const handleDeleteRequisition = async () => {
    if (!deleteReqNo) return;
    const records = stockOuts.filter(r => r.requisition_no === deleteReqNo);
    try {
      for (const record of records) {
        if (record.status === "dispensed") {
          const product = getProduct(record.product_id);
          if (product) {
            const currentStock = parseInt(product.stock) || 0;
            const qty = parseInt(record.quantity) || 0;
            await updateProduct.mutateAsync({
              id: product.id,
              data: { ...product, stock: (currentStock + qty).toString() },
            });
          }
        }
        await deleteStockOut.mutateAsync(record.id);
      }
      toast({ title: "ลบใบเบิกสำเร็จ" });
      setDeleteReqNo(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: e.message });
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
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาเลขที่ใบเบิก, หน่วยงาน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">จากวันที่</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[170px]" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">ถึงวันที่</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[170px]" />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                ล้างวันที่
              </Button>
            )}
          </div>

          {grouped.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">ไม่มีรายการเบิก</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่ใบเบิก</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead>หน่วยงาน</TableHead>
                  <TableHead className="text-center">จำนวนรายการ</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(([reqNo, records]) => {
                  const first = records[0];
                  const allDispensed = records.every(r => r.status === "dispensed");
                  const someDispensed = records.some(r => r.status === "dispensed");
                  return (
                    <TableRow key={reqNo}>
                      <TableCell className="font-medium">{reqNo}</TableCell>
                      <TableCell>{formatDate(first.date)}</TableCell>
                      <TableCell>{getDepartmentName(first.department_id)}</TableCell>
                      <TableCell className="text-center">{records.length}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={allDispensed ? "default" : someDispensed ? "secondary" : "outline"}>
                          {allDispensed ? "จ่ายแล้ว" : someDispensed ? "จ่ายบางส่วน" : "รอจ่าย"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/stock-out?edit=${encodeURIComponent(reqNo)}`)}
                            title="แก้ไข / จ่ายวัสดุ"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteReqNo(reqNo)}
                            title="ลบใบเบิก"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteReqNo} onOpenChange={() => setDeleteReqNo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบใบเบิก</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบใบเบิก {deleteReqNo} ทั้งใบหรือไม่?
              <br />
              <span className="text-destructive font-medium">
                รายการที่จ่ายแล้วจะคืนสต็อกอัตโนมัติ
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRequisition} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบใบเบิก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
