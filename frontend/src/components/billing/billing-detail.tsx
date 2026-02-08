import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Percent, Plus } from "lucide-react";
import { usePermission } from "@/hooks/usePermission";

interface BillingDetailProps {
  billing: any;
  allVisits: any[];
  formatCurrency: (value: number) => string;
  formatDate: (dateString?: string) => string;
  onDiscountClick: () => void;
  onAdjustClick: () => void;
}

const visitStatusLabels: Record<string, string> = {
  waiting: 'Menunggu',
  in_progress: 'Dalam Proses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export function BillingDetail({ 
  billing, 
  allVisits, 
  formatCurrency, 
  formatDate,
  onDiscountClick,
  onAdjustClick,
}: BillingDetailProps) {
  const { hasPermission } = usePermission();

  return (
    <div className="space-y-6">
      {/* Billing Items */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
          Detail Tagihan — <span className="font-mono">{billing.billing_number}</span>
        </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipe</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billing.items?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {item.item_type === 'registration' ? 'Pendaftaran' :
                       item.item_type === 'procedure' ? 'Tindakan' :
                       item.item_type === 'radiology' ? 'Radiologi' :
                       item.item_type === 'laboratory' ? 'Lab' :
                       item.item_type === 'medicine' ? 'Obat' :
                       item.item_type === 'room_charge' ? 'Kamar' :
                       item.item_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>
                    {item.performed_by_name ? (
                      <div className="text-xs">
                        <span className="font-medium">{item.performed_by_name}</span>
                        {item.performed_by_role && (
                          <Badge variant="secondary" className="ml-1.5 text-xs">
                            {item.performed_by_role === 'dokter' ? 'Dokter' :
                             item.performed_by_role === 'petugas' ? 'Petugas' :
                             item.performed_by_role === 'admin' ? 'Admin' :
                             item.performed_by_role === 'apoteker' ? 'Apoteker' :
                             item.performed_by_role}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-medium">Subtotal</TableCell>
                <TableCell className="text-right font-mono font-bold">{formatCurrency(billing.total_amount)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
      </div>

      {/* Summary */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Ringkasan Pembayaran</h3>
            {billing.status !== 'paid' && billing.status !== 'cancelled' && hasPermission('billing.update') && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onDiscountClick}>
                  <Percent className="mr-1.5 h-3.5 w-3.5" />
                  Diskon
                </Button>
                <Button variant="outline" size="sm" onClick={onAdjustClick}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Penyesuaian
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(billing.total_amount)}</span>
            </div>
            {billing.discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Diskon {billing.discount_reason && `(${billing.discount_reason})`}</span>
                <span className="font-mono">- {formatCurrency(billing.discount_amount)}</span>
              </div>
            )}
            {billing.adjust_amount !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Penyesuaian {billing.adjust_reason && `(${billing.adjust_reason})`}</span>
                <span className="font-mono">{billing.adjust_amount > 0 ? '+' : ''} {formatCurrency(billing.adjust_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="font-mono text-lg">{formatCurrency(billing.final_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Terbayar</span>
              <span className="font-mono">{formatCurrency(billing.paid_amount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Sisa</span>
              <span className="font-mono text-lg">{formatCurrency(billing.remaining_amount)}</span>
            </div>
          </div>
      </div>

      {/* All Visits in Registration */}
      {allVisits.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
            Daftar Kunjungan ({allVisits.length} kunjungan)
          </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Kunjungan</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Ruangan</TableHead>
                  <TableHead>Dokter</TableHead>
                  <TableHead>Waktu Masuk</TableHead>
                  <TableHead>Waktu Keluar</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allVisits.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {v.visit_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {v.visit_type === 'outpatient' ? 'Rawat Jalan' :
                         v.visit_type === 'inpatient' ? 'Rawat Inap' :
                         v.visit_type === 'emergency' ? 'UGD' :
                         v.visit_type === 'lab' ? 'Laboratorium' :
                         v.visit_type === 'radiology' ? 'Radiologi' :
                         v.visit_type === 'surgery' ? 'Operasi' :
                         v.visit_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{(v.room as { name?: string })?.name || '-'}</TableCell>
                    <TableCell className="text-xs">
                      {v.doctor?.nama_lengkap ? (
                        <span>{v.doctor.nama_lengkap}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{formatDate(v.start_time)}</TableCell>
                    <TableCell className="text-xs font-mono">{formatDate(v.end_time)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {visitStatusLabels[v.status] || v.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </div>
      )}
    </div>
  );
}
