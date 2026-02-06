import { Package, PackagePlus, PackageMinus, AlertTriangle, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Mock data for demonstration
const statsCards = [
  {
    title: "สินค้าทั้งหมด",
    value: "1,234",
    change: "+12%",
    trend: "up",
    icon: Package,
    color: "bg-primary",
  },
  {
    title: "รับเข้าเดือนนี้",
    value: "256",
    change: "+8%",
    trend: "up",
    icon: PackagePlus,
    color: "bg-success",
  },
  {
    title: "เบิกออกเดือนนี้",
    value: "189",
    change: "-5%",
    trend: "down",
    icon: PackageMinus,
    color: "bg-accent",
  },
  {
    title: "ต่ำกว่าเกณฑ์",
    value: "23",
    change: "+3",
    trend: "up",
    icon: AlertTriangle,
    color: "bg-destructive",
  },
];

const recentMovements = [
  { id: 1, type: "in", product: "กระดาษ A4", quantity: 100, date: "06/02/2026", by: "บริษัท ABC" },
  { id: 2, type: "out", product: "ปากกาลูกลื่น", quantity: 50, date: "06/02/2026", by: "ฝ่ายบุคคล" },
  { id: 3, type: "in", product: "แฟ้มเอกสาร", quantity: 200, date: "05/02/2026", by: "บริษัท XYZ" },
  { id: 4, type: "out", product: "กระดาษ A4", quantity: 30, date: "05/02/2026", by: "ฝ่ายบัญชี" },
  { id: 5, type: "in", product: "หมึกพิมพ์", quantity: 20, date: "04/02/2026", by: "บริษัท ABC" },
];

const lowStockItems = [
  { id: 1, name: "กระดาษ A4", current: 50, minimum: 100, percentage: 50 },
  { id: 2, name: "ปากกาลูกลื่น", current: 20, minimum: 50, percentage: 40 },
  { id: 3, name: "หมึกพิมพ์ HP", current: 5, minimum: 10, percentage: 50 },
  { id: 4, name: "แฟ้มพลาสติก", current: 15, minimum: 30, percentage: 50 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  <div className="flex items-center mt-2 text-sm">
                    {stat.trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-success mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive mr-1" />
                    )}
                    <span
                      className={
                        stat.trend === "up" ? "text-success" : "text-destructive"
                      }
                    >
                      {stat.change}
                    </span>
                    <span className="text-muted-foreground ml-1">จากเดือนที่แล้ว</span>
                  </div>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}
                >
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Movements */}
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
              {recentMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        movement.type === "in"
                          ? "bg-success/10 text-success"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {movement.type === "in" ? (
                        <PackagePlus className="h-5 w-5" />
                      ) : (
                        <PackageMinus className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{movement.product}</p>
                      <p className="text-sm text-muted-foreground">
                        {movement.type === "in" ? "จาก" : "ไปยัง"}: {movement.by}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        movement.type === "in" ? "text-success" : "text-accent"
                      }`}
                    >
                      {movement.type === "in" ? "+" : "-"}{movement.quantity}
                    </p>
                    <p className="text-sm text-muted-foreground">{movement.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              สินค้าต่ำกว่าเกณฑ์
            </CardTitle>
            <CardDescription>สินค้าที่ต้องสั่งซื้อเพิ่มเติม</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockItems.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.current} / {item.minimum}
                    </span>
                  </div>
                  <Progress
                    value={item.percentage}
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>สรุปภาพรวมประจำเดือน</CardTitle>
          <CardDescription>เดือนกุมภาพันธ์ 2569</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-success/5 border border-success/20">
              <PackagePlus className="h-8 w-8 mx-auto text-success mb-2" />
              <p className="text-2xl font-bold text-success">256</p>
              <p className="text-sm text-muted-foreground">รายการรับเข้า</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-accent/5 border border-accent/20">
              <PackageMinus className="h-8 w-8 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold text-accent">189</p>
              <p className="text-sm text-muted-foreground">รายการเบิกออก</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
              <Package className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold text-primary">+67</p>
              <p className="text-sm text-muted-foreground">คงเหลือสุทธิ</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
