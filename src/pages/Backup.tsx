import { useState } from "react";
import { Database, Download, Check, Package, Users, Building2, Layers, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const backupOptions = [
  { id: "products", name: "ข้อมูลสินค้า", icon: Package, description: "รายการสินค้าทั้งหมด" },
  { id: "inventory", name: "วัสดุคงคลัง", icon: Database, description: "ยอดคงเหลือสินค้า" },
  { id: "categories", name: "ประเภทสินค้า", icon: Layers, description: "รายการประเภทสินค้า" },
  { id: "companies", name: "บริษัท/ผู้ขาย", icon: Building2, description: "รายการบริษัทผู้ขาย" },
  { id: "departments", name: "หน่วยงานเบิก", icon: Users, description: "รายการหน่วยงาน" },
  { id: "stock-in", name: "ประวัติรับเข้า", icon: FileText, description: "รายการรับเข้าทั้งหมด" },
  { id: "stock-out", name: "ประวัติเบิกจ่าย", icon: FileText, description: "รายการเบิกจ่ายทั้งหมด" },
];

export default function Backup() {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleToggle = (id: string) => {
    setSelectedOptions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedOptions.length === backupOptions.length) {
      setSelectedOptions([]);
    } else {
      setSelectedOptions(backupOptions.map((opt) => opt.id));
    }
  };

  const handleExport = async () => {
    if (selectedOptions.length === 0) {
      toast({ variant: "destructive", title: "กรุณาเลือกข้อมูลที่ต้องการสำรอง" });
      return;
    }

    setIsExporting(true);
    
    // Simulate export delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setIsExporting(false);
    toast({
      title: "สำรองข้อมูลสำเร็จ",
      description: `ส่งออก ${selectedOptions.length} รายการเป็นไฟล์ Excel`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            สำรองฐานข้อมูล
          </CardTitle>
          <CardDescription>
            เลือกข้อมูลที่ต้องการสำรองและส่งออกเป็นไฟล์ Excel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Select All */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedOptions.length === backupOptions.length}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="font-medium">
                เลือกทั้งหมด
              </Label>
            </div>
            <span className="text-sm text-muted-foreground">
              เลือกแล้ว {selectedOptions.length} / {backupOptions.length} รายการ
            </span>
          </div>

          {/* Backup Options Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {backupOptions.map((option) => {
              const isSelected = selectedOptions.includes(option.id);
              return (
                <div
                  key={option.id}
                  onClick={() => handleToggle(option.id)}
                  className={`relative cursor-pointer rounded-lg border p-4 transition-all hover:border-primary ${
                    isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <option.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{option.name}</h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <Check className="h-5 w-5 text-primary" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export Button */}
          <div className="flex justify-end pt-4">
            <Button
              size="lg"
              onClick={handleExport}
              disabled={selectedOptions.length === 0 || isExporting}
            >
              {isExporting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  กำลังส่งออก...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  สำรองข้อมูล ({selectedOptions.length} รายการ)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
