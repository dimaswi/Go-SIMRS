import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { XCircle } from "lucide-react";
import { usePermission } from "@/hooks/usePermission";

interface PaymentHistoryProps {
  payments: any[];
  formatCurrency: (value: number) => string;
  formatDate: (dateString?: string) => string;
  onVoidPayment: (paymentId: number) => void;
}

export function PaymentHistory({ 
  payments, 
  formatCurrency, 
  formatDate,
  onVoidPayment,
}: PaymentHistoryProps) {
  const { hasPermission } = usePermission();

  if (payments.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Belum ada riwayat pembayaran</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">Riwayat Pembayaran</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Pembayaran</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Kasir</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-mono text-xs font-medium">{payment.payment_number}</TableCell>
                <TableCell className="text-xs font-mono">{formatDate(payment.payment_date)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {payment.payment_method === 'cash' ? 'Tunai' :
                     payment.payment_method === 'bpjs' ? 'BPJS' :
                     payment.payment_method === 'insurance' ? 'Asuransi' :
                     payment.payment_method === 'transfer' ? 'Transfer' :
                     payment.payment_method === 'debit' ? 'Debit' :
                     payment.payment_method === 'credit' ? 'Kredit' :
                     payment.payment_method === 'qris' ? 'QRIS' :
                     payment.payment_method}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(payment.amount)}</TableCell>
                <TableCell className="text-xs">{payment.cashier?.full_name || '-'}</TableCell>
                <TableCell>
                  <Badge variant={payment.status === 'completed' ? 'default' : 'destructive'} className="text-xs">
                    {payment.status === 'completed' ? 'Selesai' : 'Dibatalkan'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {payment.status === 'completed' && hasPermission('billing.payment') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 px-2"
                      onClick={() => onVoidPayment(payment.id)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Batalkan
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    </div>
  );
}
