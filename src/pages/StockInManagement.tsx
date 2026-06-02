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
import { useSheetData, useSheetDelete } from "@/hooks/useGoogleSheets";

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

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteInvNo, setDeleteInvNo] = useState<string | null>(null);
  const { toast } = useToast();

  const getProductName = (id: string) => products.find(p => p.id === id)?.name || id;
  const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || id;

  const grouped = useMemo(() => {
    const map = new Map<string, StockInRecord[]>();
    stockIns.forEach(r => {
      const key = r.invoice_no || r.id;
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
      entries = entries.filter(([invNo, records]) =>
        invNo.toLowerCase().includes(q) ||
        getCompanyName(records[0].company_id).toLowerCase().includes(q) ||
        records.some(r => getProductName(r.product_id).toLowerCase().includes(q))
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
  }, [stockIns, search, dateFrom, dateTo, products, companies]);

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), "d MMM yyyy", { locale: th }); }
    catch { return dateStr; }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteInvNo) return;
    const records = stockIns.filter(r => r.invoice_no === deleteInvNo);
    try {
      for (const record of records) {
        await deleteStockIn.mutateAsync(record.id);
      }
      toast({ title: "ลบใบส่งของสำเร็จ" });
      setDeleteInvNo(null);
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่ใบส่งของ</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead>บริษัท</TableHead>
                  <TableHead className="text-center">จำนวนรายการ</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(([invNo, records]) => {
                  const first = records[0];
                  return (
                    <TableRow key={invNo}>
                      <TableCell className="font-medium">{invNo}</TableCell>
                      <TableCell>{formatDate(first.date)}</TableCell>
                      <TableCell>{getCompanyName(first.company_id)}</TableCell>
                      <TableCell className="text-center">{records.length}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/stock-in?edit=${encodeURIComponent(invNo)}`)}
                            title="แก้ไข"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteInvNo(invNo)}
                            title="ลบใบส่งของ"
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

      <AlertDialog open={!!deleteInvNo} onOpenChange={() => setDeleteInvNo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบใบส่งของ</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการลบใบส่งของ {deleteInvNo} ทั้งใบหรือไม่?
              <br />
              <span className="text-muted-foreground text-sm">
                สต็อกจะคำนวณใหม่อัตโนมัติจากประวัติที่เหลือ
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบใบส่งของ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
