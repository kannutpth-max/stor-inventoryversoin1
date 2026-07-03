import { Package, PackagePlus, PackageMinus, AlertTriangle, TrendingUp, TrendingDown, BarChart3, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSheetData } from "@/hooks/useGoogleSheets";
import { useMemo, useState } from "react";
import { parseSheetDate } from "@/lib/utils";

interface Product { id: string; name: string; category_id: string; unit_id: string; min_stock: string; [k: string]: string; }
interface StockIn { id: string; product_id: string; quantity: string; date: string; company_id: string; [k: string]: string; }
interface StockOut { id: string; product_id: string; quantity: string; date: string; department_id: string; [k: string]: string; }
interface Company { id: string; name: string; [k: string]: string; }
interface Department { id: string; name: string; [k: string]: string; }

export default function Dashboard() {
  const { data: products = [], isLoading: loadingProducts } = useSheetData<Product>("products");
  const { data: stockIn = [], isLoading: loadingIn } = useSheetData<StockIn>("stock_in");
  const { data: stockOut = [], isLoading: loadingOut } = useSheetData<StockOut>("stock_out");
  const { data: companies = [] } = useSheetData<Company>("companies");
  const { data: departments = [] } = useSheetData<Department>("departments");

  const isLoading = loadingProducts || loadingIn || loadingOut;

  const nowDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(nowDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(nowDate.getFullYear());

  const stats = useMemo(() => {
    const parseDate = (d: string) => {
      if (!d) return null;
      // Support Sheets serial numbers, ISO, and DD/MM/YYYY
      const parts = d.split("/");
      if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0]);
      const parsed = parseSheetDate(d);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const thisMonthIn = stockIn.filter(s => {
      const d = parseDate(s.date);
      return d && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    const thisMonthOut = stockOut.filter(s => {
      const d = parseDate(s.date);
      return d && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    const totalIn = thisMonthIn.reduce((sum, s) => sum + (parseInt(s.quantity) || 0), 0);
    const totalOut = thisMonthOut.reduce((sum, s) => sum + (parseInt(s.quantity) || 0), 0);

    // Calculate stock per product
    const stockMap: Record<string, number> = {};
    stockIn.forEach(s => { stockMap[s.product_id] = (stockMap[s.product_id] || 0) + (parseInt(s.quantity) || 0); });
    stockOut.forEach(s => { stockMap[s.product_id] = (stockMap[s.product_id] || 0) - (parseInt(s.quantity) || 0); });

    const lowStock = products.filter(p => {
      const min = parseInt(p.min_stock) || 0;
      const current = stockMap[p.id] || 0;
      return min > 0 && current < min;
    }).map(p => ({
      id: p.id,
      name: p.name,
      current: stockMap[p.id] || 0,
      minimum: parseInt(p.min_stock) || 0,
      percentage: Math.max(0, Math.min(100, Math.round(((stockMap[p.id] || 0) / (parseInt(p.min_stock) || 1)) * 100))),
    }));

    // Recent movements in selected month (top 5)
    const allMovements = [
      ...stockIn.map(s => ({ ...s, type: "in" as const })),
      ...stockOut.map(s => ({ ...s, type: "out" as const })),
    ].filter(m => {
      const d = parseDate(m.date);
      return d && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    }).sort((a, b) => {
      const da = parseDate(a.date)?.getTime() || 0;
      const db = parseDate(b.date)?.getTime() || 0;
      return db - da;
    }).slice(0, 5);

    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));
    const productMap = Object.fromEntries(products.map(p => [p.id, p.name]));

    const recentMovements = allMovements.map((m, i) => ({
      id: i,
      type: m.type,
      product: productMap[m.product_id] || m.product_id,
      quantity: parseInt(m.quantity) || 0,
      date: m.date,
      by: m.type === "in" ? (companyMap[(m as any).company_id] || "") : (deptMap[(m as any).department_id] || ""),
    }));

    return { totalProducts: products.length, totalIn, totalOut, lowStockCount: lowStock.length, lowStock, recentMovements, netChange: totalIn - totalOut };
  }, [products, stockIn, stockOut, companies, departments, selectedMonth, selectedYear]);

  const thaiMonth = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const monthLabel = `${thaiMonth[selectedMonth]} ${selectedYear + 543}`;
  const yearOptions = Array.from({ length: 6 }, (_, i) => nowDate.getFullYear() - i);
  const isCurrentMonth = selectedMonth === nowDate.getMonth() && selectedYear === nowDate.getFullYear();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  const statsCards = [
    { title: "วัสดุทั้งหมด", value: stats.totalProducts.toLocaleString(), icon: Package, color: "bg-primary" },
    { title: "รับเข้าเดือนนี้", value: stats.totalIn.toLocaleString(), icon: PackagePlus, color: "bg-success" },
    { title: "เบิกออกเดือนนี้", value: stats.totalOut.toLocaleString(), icon: PackageMinus, color: "bg-accent" },
    { title: "ต่ำกว่าเกณฑ์", value: stats.lowStockCount.toLocaleString(), icon: AlertTriangle, color: "bg-destructive" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">แสดงข้อมูลของ:</span>
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="เดือน" /></SelectTrigger>
            <SelectContent>
              {thaiMonth.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="ปี" /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isCurrentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSelectedMonth(nowDate.getMonth()); setSelectedYear(nowDate.getFullYear()); }}
            >
              เดือนนี้
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {statsCards.map((stat, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              ความเคลื่อนไหวล่าสุด
            </CardTitle>
            <CardDescription>รายการรับเข้าและเบิกออกล่าสุด</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentMovements.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีรายการ</p>
              )}
              {stats.recentMovements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${movement.type === "in" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>
                      {movement.type === "in" ? <PackagePlus className="h-5 w-5" /> : <PackageMinus className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium">{movement.product}</p>
                      <p className="text-sm text-muted-foreground">{movement.type === "in" ? "จาก" : "ไปยัง"}: {movement.by}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${movement.type === "in" ? "text-success" : "text-accent"}`}>
                      {movement.type === "in" ? "+" : "-"}{movement.quantity}
                    </p>
                    <p className="text-sm text-muted-foreground">{movement.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              วัสดุต่ำกว่าเกณฑ์
            </CardTitle>
            <CardDescription>วัสดุที่ต้องสั่งซื้อเพิ่มเติม</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.lowStock.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">ไม่มีวัสดุต่ำกว่าเกณฑ์</p>
              )}
              {stats.lowStock.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground">{item.current} / {item.minimum}</span>
                  </div>
                  <Progress value={item.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>สรุปภาพรวมประจำเดือน</CardTitle>
          <CardDescription>เดือน{monthLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-success/5 border border-success/20">
              <PackagePlus className="h-8 w-8 mx-auto text-success mb-2" />
              <p className="text-2xl font-bold text-success">{stats.totalIn}</p>
              <p className="text-sm text-muted-foreground">รายการรับเข้า</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-accent/5 border border-accent/20">
              <PackageMinus className="h-8 w-8 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold text-accent">{stats.totalOut}</p>
              <p className="text-sm text-muted-foreground">รายการเบิกออก</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
              <Package className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold text-primary">{stats.netChange >= 0 ? "+" : ""}{stats.netChange}</p>
              <p className="text-sm text-muted-foreground">คงเหลือสุทธิ</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
