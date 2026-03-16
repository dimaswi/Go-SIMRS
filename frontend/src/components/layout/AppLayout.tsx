import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context";
import { useState } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  // Get initial state from localStorage, default to true
  const getInitialState = () => {
    const savedState = localStorage.getItem('sidebar_state');
    return savedState === null ? true : savedState === 'true';
  };

  const [open, setOpen] = useState(getInitialState);

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
