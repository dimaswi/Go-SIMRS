import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store";

export function AppLayout({ children }: { children: React.ReactNode }) {
  // Get initial state from localStorage, default to true
  const getInitialState = () => {
    const savedState = localStorage.getItem('sidebar_state');
    return savedState === null ? true : savedState === 'true';
  };

  const [open, setOpen] = useState(getInitialState);

  // Automatically refresh profile on mount to ensure we have the latest data (e.g. employee object)
  const { setUser } = useAuthStore();
  useEffect(() => {
    import("@/lib/api").then(({ authApi }) => {
      authApi.getProfile().then(res => {
        if (res.data) setUser(res.data);
      }).catch(console.error);
    });
  }, [setUser]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    localStorage.setItem('sidebar_state', String(newOpen));
  };

  return (
    <BreadcrumbProvider>
    <SidebarProvider open={open} onOpenChange={handleOpenChange}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div id="app-main-scroll-container" className="flex flex-col flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </BreadcrumbProvider>
  );
}
