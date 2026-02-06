import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
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
import Reports from "./pages/Reports";
import Backup from "./pages/Backup";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route wrapper
function ProtectedRoute({ 
  children, 
  title, 
  user, 
  onLogout 
}: { 
  children: React.ReactNode; 
  title: string;
  user: User | null;
  onLogout: () => void;
}) {
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <MainLayout title={title} userEmail={user.email} onLogout={onLogout}>
      {children}
    </MainLayout>
  );
}

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route 
              path="/auth" 
              element={user ? <Navigate to="/dashboard" replace /> : <Auth />} 
            />
            <Route 
              path="/" 
              element={<Navigate to={user ? "/dashboard" : "/auth"} replace />} 
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute title="ภาพรวม" user={user} onLogout={handleLogout}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute title="ข้อมูลสินค้า" user={user} onLogout={handleLogout}>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute title="ประเภทสินค้า" user={user} onLogout={handleLogout}>
                  <Categories />
                </ProtectedRoute>
              }
            />
            <Route
              path="/units"
              element={
                <ProtectedRoute title="หน่วยนับ" user={user} onLogout={handleLogout}>
                  <Units />
                </ProtectedRoute>
              }
            />
            <Route
              path="/companies"
              element={
                <ProtectedRoute title="บริษัท/ผู้ขาย" user={user} onLogout={handleLogout}>
                  <Companies />
                </ProtectedRoute>
              }
            />
            <Route
              path="/departments"
              element={
                <ProtectedRoute title="หน่วยงานเบิก" user={user} onLogout={handleLogout}>
                  <Departments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-in"
              element={
                <ProtectedRoute title="รับเข้าสินค้า" user={user} onLogout={handleLogout}>
                  <StockIn />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-out"
              element={
                <ProtectedRoute title="เบิกสินค้า" user={user} onLogout={handleLogout}>
                  <StockOut />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute title="รายงาน" user={user} onLogout={handleLogout}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/backup"
              element={
                <ProtectedRoute title="สำรองข้อมูล" user={user} onLogout={handleLogout}>
                  <Backup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute title="ตั้งค่า" user={user} onLogout={handleLogout}>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
