export type PharmacyBadgeVariant = "default" | "secondary" | "destructive" | "outline";

type PharmacyStatusMeta = {
  label: string;
  variant: PharmacyBadgeVariant;
  className: string;
};

export const PHARMACY_ORDER_STATUS_META: Record<string, PharmacyStatusMeta> = {
  ordered: {
    label: "Aktif",
    variant: "outline",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  pending: {
    label: "Menunggu Telaah",
    variant: "outline",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  reviewed: {
    label: "Sudah Ditelaah",
    variant: "outline",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  preparing: {
    label: "Disiapkan",
    variant: "outline",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  ready: {
    label: "Siap Diserahkan",
    variant: "outline",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  delivered: {
    label: "Sudah Diserahkan",
    variant: "outline",
    className: "border-green-200 bg-green-50 text-green-700",
  },
  cancelled: {
    label: "Dibatalkan",
    variant: "outline",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  partial: {
    label: "Sebagian",
    variant: "outline",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  returned: {
    label: "Ada Return",
    variant: "outline",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  in_progress: {
    label: "Dikerjakan",
    variant: "outline",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
};

export const PHARMACY_ITEM_STATUS_META: Record<string, PharmacyStatusMeta> = {
  ordered: {
    label: "Dipesan",
    variant: "outline",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  available: {
    label: "Tersedia",
    variant: "outline",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  ready: {
    label: "Siap",
    variant: "outline",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  delivered: {
    label: "Diserahkan",
    variant: "outline",
    className: "border-green-200 bg-green-50 text-green-700",
  },
  returned: {
    label: "Dikembalikan",
    variant: "outline",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  cancelled: {
    label: "Dibatalkan",
    variant: "outline",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const FALLBACK_ORDER_META: PharmacyStatusMeta = {
  label: "Status",
  variant: "outline",
  className: "border-slate-200 bg-slate-50 text-slate-700",
};

const FALLBACK_ITEM_META: PharmacyStatusMeta = {
  label: "Status",
  variant: "outline",
  className: "border-slate-200 bg-slate-50 text-slate-700",
};

export const getPharmacyOrderStatusMeta = (status?: string): PharmacyStatusMeta => {
  if (!status) {
    return FALLBACK_ORDER_META;
  }
  return PHARMACY_ORDER_STATUS_META[status] || {
    ...FALLBACK_ORDER_META,
    label: status,
  };
};

export const getPharmacyItemStatusMeta = (status?: string): PharmacyStatusMeta => {
  if (!status) {
    return FALLBACK_ITEM_META;
  }
  return PHARMACY_ITEM_STATUS_META[status] || {
    ...FALLBACK_ITEM_META,
    label: status,
  };
};
