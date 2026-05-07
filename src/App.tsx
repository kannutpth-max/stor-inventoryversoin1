import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, UserRole } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Units from "./pages/Units";
import Companies from "./pages/Companies";
import Departments from "./pages/Departments";
import StockIn from "./pages/StockIn";
import StockOut from "./pages/StockOut";
import StockInManagement from "./pages/StockInManagement";
import StockOutManagement from "./pages/StockOutManagement";
import Reports from "./pages/Reports";
import Backup from "./pages/Backup";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Route accessible by specific roles
function ProtectedRoute({
  children,
  title,
  allowedRoles = ["admin", "user"],
}: {
  children: React.ReactNode;
  title: string;
  allowedRoles?: UserRole[];
}) {
  const { user, logout } = useAuth();

  if (!user) return <Navigate to="/auth" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return (
    <MainLayout title={title} userEmail={user.username} onLogout={logout}>
      {children}
    </MainLayout>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/auth"} replace />} />

      {/* Accessible by all logged-in users */}
      <Route path="/dashboard" element={<ProtectedRoute title="ภาพรวม"><Dashboard /></ProtectedRoute>} />
      <Route path="/stock-out" element={<ProtectedRoute title="เบิกวัสดุ"><StockOut /></ProtectedRoute>} />

      {/* Admin only */}
      <Route path="/products" element={<ProtectedRoute title="ข้อมูลวัสดุ" allowedRoles={["admin"]}><Products /></ProtectedRoute>} />
      <Route path="/categories" element={<ProtectedRoute title="ประเภทวัสดุ" allowedRoles={["admin"]}><Categories /></ProtectedRoute>} />
      <Route path="/units" element={<ProtectedRoute title="หน่วยนับ" allowedRoles={["admin"]}><Units /></ProtectedRoute>} />
      <Route path="/companies" element={<ProtectedRoute title="บริษัท/ผู้ขาย" allowedRoles={["admin"]}><Companies /></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute title="หน่วยงานเบิก" allowedRoles={["admin"]}><Departments /></ProtectedRoute>} />
      <Route path="/stock-in" element={<ProtectedRoute title="รับเข้าวัสดุ" allowedRoles={["admin"]}><StockIn /></ProtectedRoute>} />
      <Route path="/stock-out-manage" element={<ProtectedRoute title="จัดการรายการเบิก" allowedRoles={["admin"]}><StockOutManagement /></ProtectedRoute>} />
      <Route path="/stock-in-manage" element={<ProtectedRoute title="จัดการรายการรับ" allowedRoles={["admin"]}><StockInManagement /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute title="รายงาน" allowedRoles={["admin"]}><Reports /></ProtectedRoute>} />
      <Route path="/backup" element={<ProtectedRoute title="สำรองข้อมูล" allowedRoles={["admin"]}><Backup /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute title="ตั้งค่า" allowedRoles={["admin"]}><Settings /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
