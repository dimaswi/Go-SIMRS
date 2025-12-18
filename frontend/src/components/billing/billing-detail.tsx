import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const visitStatusColors: Record<string, string> = {
  waiting: 'bg-yellow-500 text-black',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
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
    <div className="space-y-4">
      {/* Billing Items */}
      <Card className="border-none shadow-sm">
        <CardHeader className="border-b bg-muted/30 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Detail Tagihan - <span className="font-mono">{billing.billing_number}</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
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
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="border-none shadow-sm bg-muted/20">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Ringkasan Pembayaran</CardTitle>
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
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(billing.total_amount)}</span>
            </div>
            {billing.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Diskon {billing.discount_reason && `(${billing.discount_reason})`}</span>
                <span className="font-mono">- {formatCurrency(billing.discount_amount)}</span>
              </div>
            )}
            {billing.adjust_amount !== 0 && (
              <div className={`flex justify-between text-sm ${billing.adjust_amount > 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                <span>Penyesuaian {billing.adjust_reason && `(${billing.adjust_reason})`}</span>
                <span className="font-mono">{billing.adjust_amount > 0 ? '+' : ''} {formatCurrency(billing.adjust_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="font-mono text-lg">{formatCurrency(billing.final_amount)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Terbayar</span>
              <span className="font-mono">{formatCurrency(billing.paid_amount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Sisa</span>
              <span className="font-mono text-lg text-orange-600">{formatCurrency(billing.remaining_amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Visits in Registration */}
      {allVisits.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-3">
            <CardTitle className="text-sm font-semibold">
              Daftar Kunjungan ({allVisits.length} kunjungan)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
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
                      <Badge className={`text-xs ${visitStatusColors[v.status] || ''}`}>
                        {visitStatusLabels[v.status] || v.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
