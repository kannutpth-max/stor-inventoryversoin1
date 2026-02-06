import { Settings as SettingsIcon, User, Shield, Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            ตั้งค่าระบบ
          </CardTitle>
          <CardDescription>
            จัดการการตั้งค่าต่างๆ ของระบบคลังสินค้า
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Settings */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
              <User className="h-5 w-5" />
              ข้อมูลส่วนตัว
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>แสดงชื่อผู้ใช้ในรายงาน</Label>
                  <p className="text-sm text-muted-foreground">แสดงชื่อผู้จัดทำในรายงานที่พิมพ์ออก</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          <Separator />

          {/* Notification Settings */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
              <Bell className="h-5 w-5" />
              การแจ้งเตือน
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>แจ้งเตือนสินค้าต่ำกว่าเกณฑ์</Label>
                  <p className="text-sm text-muted-foreground">แสดงการแจ้งเตือนเมื่อสินค้าต่ำกว่าเกณฑ์ขั้นต่ำ</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>แจ้งเตือนการเบิกสินค้า</Label>
                  <p className="text-sm text-muted-foreground">แสดงการแจ้งเตือนเมื่อมีการเบิกสินค้า</p>
                </div>
                <Switch />
              </div>
            </div>
          </div>

          <Separator />

          {/* Security Settings */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
              <Shield className="h-5 w-5" />
              ความปลอดภัย
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>ยืนยันก่อนลบข้อมูล</Label>
                  <p className="text-sm text-muted-foreground">แสดงข้อความยืนยันก่อนลบข้อมูลทุกครั้ง</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>ออกจากระบบอัตโนมัติ</Label>
                  <p className="text-sm text-muted-foreground">ออกจากระบบเมื่อไม่มีการใช้งานเกิน 30 นาที</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
