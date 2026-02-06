import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  userEmail?: string;
  onLogout: () => void;
}

export function MainLayout({ children, title, userEmail, onLogout }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        <Header
          title={title}
          userEmail={userEmail}
          onLogout={onLogout}
          onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        
        <main className="p-4 md:p-6">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
