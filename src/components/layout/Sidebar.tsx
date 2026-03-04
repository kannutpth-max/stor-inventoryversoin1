import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  PackageMinus,
  ClipboardList,
  ClipboardCheck,
  Building2,
  Layers,
  Ruler,
  Users,
  FileText,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  onLogout: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

const menuItems = [
  {
    title: "ภาพรวม",
    items: [
      { name: "แดชบอร์ด", path: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "การจัดการสินค้า",
    items: [
      { name: "ข้อมูลสินค้า", path: "/products", icon: Package },
      { name: "รับเข้าสินค้า", path: "/stock-in", icon: PackagePlus },
      { name: "จัดการรายการรับ", path: "/stock-in-manage", icon: ClipboardList },
      { name: "เบิกสินค้า", path: "/stock-out", icon: PackageMinus },
      { name: "จัดการรายการเบิก", path: "/stock-out-manage", icon: ClipboardCheck },
    ],
  },
  {
    title: "ข้อมูลหลัก",
    items: [
      { name: "ประเภทสินค้า", path: "/categories", icon: Layers },
      { name: "หน่วยนับ", path: "/units", icon: Ruler },
      { name: "บริษัท/ผู้ขาย", path: "/companies", icon: Building2 },
      { name: "หน่วยงานเบิก", path: "/departments", icon: Users },
    ],
  },
  {
    title: "รายงาน",
    items: [
      { name: "รายงาน", path: "/reports", icon: FileText },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { name: "สำรองข้อมูล", path: "/backup", icon: Database },
      { name: "ตั้งค่า", path: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar({ onLogout, collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ease-in-out flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Package className="h-8 w-8 text-sidebar-primary" />
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">
                คลังสินค้า
              </h1>
              <p className="text-xs text-sidebar-foreground/60">
                Inventory System
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((section, idx) => (
          <div key={idx} className="mb-4">
            {!collapsed && (
              <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {section.title}
              </p>
            )}
            <ul className="space-y-1 px-2">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center"
                      )}
                      title={collapsed ? item.name : undefined}
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.name}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          onClick={onLogout}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive",
            collapsed ? "justify-center" : "justify-start gap-3"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>ออกจากระบบ</span>}
        </Button>
      </div>
    </aside>
  );
}
