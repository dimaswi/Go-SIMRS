import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface VisitOverviewProps {
  visit?: any;
  billing?: any;
  formatCurrency: (value: number) => string;
}

export function VisitOverview({ billing, formatCurrency }: VisitOverviewProps) {
  // If there's no billing yet, show message
  if (!billing) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Tagihan belum dibuat untuk kunjungan ini.
          </p>
          <p className="text-xs text-muted-foreground">
            Klik tombol "Ambil Tagihan" untuk membuat tagihan setelah kunjungan selesai.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get data from billing items
  const billingItems = billing.items || [];
  
  // Categorize items
  const procedures = billingItems.filter((item: any) => item.item_type === 'procedure');
  const radiologyItems = billingItems.filter((item: any) => item.item_type === 'radiology');
  const laboratoryItems = billingItems.filter((item: any) => item.item_type === 'laboratory');
  const medicineItems = billingItems.filter((item: any) => item.item_type === 'medicine');
  const registrationItems = billingItems.filter((item: any) => item.item_type === 'registration');
  const roomChargeItems = billingItems.filter((item: any) => item.item_type === 'room_charge');

  // Calculate totals
  const proceduresTotal = procedures.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  const radiologyTotal = radiologyItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  const laboratoryTotal = laboratoryItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  const medicineTotal = medicineItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  const registrationTotal = registrationItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  const roomChargeTotal = roomChargeItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);

  const hasProcedures = procedures.length > 0;
  const hasRadiology = radiologyItems.length > 0;
  const hasLaboratory = laboratoryItems.length > 0;
  const hasMedicines = medicineItems.length > 0;
  const hasRegistration = registrationItems.length > 0;
  const hasRoomCharge = roomChargeItems.length > 0;
  
  const hasAnyData = hasProcedures || hasRadiology || hasLaboratory || hasMedicines || hasRegistration || hasRoomCharge;

  // If no data in billing, show empty state
  if (!hasAnyData) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada data tindakan, pemeriksaan, atau obat pada kunjungan ini.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pendaftaran */}
      {hasRegistration && (
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-3">
            <CardTitle className="text-sm font-semibold">Biaya Pendaftaran</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrationItems.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">Total Pendaftaran</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(registrationTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tindakan */}
      {hasProcedures && (
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-3">
            <CardTitle className="text-sm font-semibold">Tindakan Medis</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Oleh</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procedures.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-xs">
                      {item.performed_by_name ? (
                        <div>
                          <span className="font-medium">{item.performed_by_name}</span>
                          {item.performed_by_role && (
                            <Badge variant="secondary" className="ml-1.5 text-xs">
                              {item.performed_by_role === 'dokter' ? 'Dokter' : item.performed_by_role}
                            </Badge>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">Total Tindakan</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(proceduresTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Radiologi */}
      {hasRadiology && (
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-3">
            <CardTitle className="text-sm font-semibold">Pemeriksaan Radiologi</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Oleh</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {radiologyItems.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-xs">
                      {item.performed_by_name ? (
                        <div>
                          <span className="font-medium">{item.performed_by_name}</span>
                          {item.performed_by_role && (
                            <Badge variant="secondary" className="ml-1.5 text-xs">
                              {item.performed_by_role === 'dokter' ? 'Dokter' : item.performed_by_role}
                            </Badge>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">Total Radiologi</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(radiologyTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Laboratorium */}
      {hasLaboratory && (
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-3">
            <CardTitle className="text-sm font-semibold">Pemeriksaan Laboratorium</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Oleh</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laboratoryItems.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-xs">
                      {item.performed_by_name ? (
                        <div>
                          <span className="font-medium">{item.performed_by_name}</span>
                          {item.performed_by_role && (
                            <Badge variant="secondary" className="ml-1.5 text-xs">
                              {item.performed_by_role === 'dokter' ? 'Dokter' : item.performed_by_role}
                            </Badge>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">Total Laboratorium</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(laboratoryTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Obat */}
      {hasMedicines && (
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-3">
            <CardTitle className="text-sm font-semibold">Obat-obatan</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Obat</TableHead>
                  <TableHead>Oleh</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicineItems.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-xs">
                      {item.performed_by_name ? (
                        <div>
                          <span className="font-medium">{item.performed_by_name}</span>
                          {item.performed_by_role && (
                            <Badge variant="secondary" className="ml-1.5 text-xs">
                              {item.performed_by_role === 'apoteker' ? 'Apoteker' : item.performed_by_role}
                            </Badge>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">Total Obat</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(medicineTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Biaya Kamar (untuk rawat inap) */}
      {hasRoomCharge && (
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-3">
            <CardTitle className="text-sm font-semibold">Biaya Kamar</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomChargeItems.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">Total Biaya Kamar</TableCell>
                  <TableCell className="text-right font-mono font-bold">{formatCurrency(roomChargeTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Total Summary */}
      <Card className="border-none shadow-sm bg-muted/20">
        <CardHeader className="border-b bg-muted/40 pb-3">
          <CardTitle className="text-sm font-semibold">Ringkasan Biaya</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {hasRegistration && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pendaftaran</span>
                <span className="font-mono">{formatCurrency(registrationTotal)}</span>
              </div>
            )}
            {hasProcedures && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tindakan Medis</span>
                <span className="font-mono">{formatCurrency(proceduresTotal)}</span>
              </div>
            )}
            {hasRadiology && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Radiologi</span>
                <span className="font-mono">{formatCurrency(radiologyTotal)}</span>
              </div>
            )}
            {hasLaboratory && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Laboratorium</span>
                <span className="font-mono">{formatCurrency(laboratoryTotal)}</span>
              </div>
            )}
            {hasMedicines && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Obat-obatan</span>
                <span className="font-mono">{formatCurrency(medicineTotal)}</span>
              </div>
            )}
            {hasRoomCharge && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Biaya Kamar</span>
                <span className="font-mono">{formatCurrency(roomChargeTotal)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(billing.total_amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
