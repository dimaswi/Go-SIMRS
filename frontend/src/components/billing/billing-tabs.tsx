import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import {
  Receipt,
  FileText,
  CreditCard,
  History,
} from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  permission: string;
}

interface BillingTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  hasBilling: boolean;
  billingStatus?: string;
}

export function BillingTabs({ 
  activeTab, 
  onTabChange, 
  hasBilling,
  billingStatus,
}: BillingTabsProps) {
  const { hasPermission } = usePermission();

  const tabs: Tab[] = [
    {
      id: "overview",
      label: "Ringkasan Kunjungan",
      icon: <FileText />,
      permission: "billing.view",
    },
    ...(hasBilling ? [{
      id: "billing-detail",
      label: "Detail Tagihan",
      icon: <Receipt />,
      permission: "billing.view",
    }] : []),
    ...(hasBilling && billingStatus !== 'cancelled' && billingStatus !== 'paid' ? [{
      id: "payment",
      label: "Pembayaran",
      icon: <CreditCard />,
      permission: "billing.payment",
    }] : []),
    ...(hasBilling ? [{
      id: "payment-history",
      label: "Riwayat Pembayaran",
      icon: <History />,
      permission: "billing.view",
    }] : []),
  ];

  // Filter tabs based on permissions
  const filteredTabs = tabs.filter(tab => hasPermission(tab.permission));

  return (
    <nav className="space-y-0.5">
      {filteredTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors text-xs",
            activeTab === tab.id
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <span className={cn(
            "[&>svg]:h-3.5 [&>svg]:w-3.5",
            activeTab === tab.id ? "text-primary" : "text-muted-foreground/70"
          )}>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
