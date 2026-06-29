const fs = require('fs');

const path = 'c:/Users/User/Documents/Klinik Kedungadem/Go-SIMRS/frontend/src/pages/billing/show.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace Kunjungan Modal content
const kunjunganStart = '<div className="relative border-l-2 border-muted ml-3 space-y-6">';
const kunjunganEnd = '</div>\n          </div>\n        </DialogContent>\n      </Dialog>\n\n      {/* ===== RIWAYAT PEMBAYARAN MODAL ===== */}';

let kIdxStart = code.indexOf(kunjunganStart);
let kIdxEnd = code.indexOf('</div>\n          </div>\n        </DialogContent>\n      </Dialog>', kIdxStart);

if (kIdxStart !== -1 && kIdxEnd !== -1) {
    const newKunjungan = `<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tgl Kunjungan</TableHead>
                  <TableHead>No. Kunjungan</TableHead>
                  <TableHead>Poli / Ruangan</TableHead>
                  <TableHead>Dokter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(allVisits.length <= 1 ? [visit] : allVisits).map((v: any, idx: number) => (
                  <TableRow key={v.id || idx}>
                    <TableCell className="whitespace-nowrap">{v.start_time ? formatDateShort(v.start_time) : '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{v.visit_number || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <span>{v.room?.name || '-'}</span>
                        <Badge variant="outline" className={\`w-fit text-[10px] px-1.5 py-0 \${visitTypeBadgeColor(v.visit_type)}\`}>
                          {visitTypeLabel(v.visit_type)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{v.doctor?.nama_lengkap || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>`;
    code = code.substring(0, kIdxStart) + newKunjungan + code.substring(kIdxEnd);
} else {
    console.log("Could not find Kunjungan Modal block");
}

// Replace Pembayaran Modal content
const pembayaranStart = '<div className="space-y-4">\n                {payments.map((payment) => (';
const pembayaranEnd = '</div>\n            )}\n          </div>\n        </DialogContent>\n      </Dialog>\n    </div>\n  );\n}';

let pIdxStart = code.indexOf(pembayaranStart);
let pIdxEnd = code.indexOf('</div>\n            )}\n          </div>', pIdxStart);

if (pIdxStart !== -1 && pIdxEnd !== -1) {
    const newPembayaran = `<Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>No. Transaksi</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Status</TableHead>
                    {hasPermission('billing.void_payment') && <TableHead className="text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap">{formatDateShort(payment.payment_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{payment.payment_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {paymentMethodLabel(payment.payment_method)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold">{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>
                        <div className={\`flex items-center gap-1.5 text-xs font-medium \${payment.status === 'completed' ? 'text-green-600' : 'text-red-600'}\`}>
                          {payment.status === 'completed' ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          {payment.status === 'completed' ? 'Berhasil' : 'Dibatalkan'}
                        </div>
                      </TableCell>
                      {hasPermission('billing.void_payment') && (
                        <TableCell className="text-right">
                          {payment.status === 'completed' && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => { setSelectedPaymentId(payment.id); setVoidPaymentDialogOpen(true); }}>
                              Void
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>`;
    code = code.substring(0, pIdxStart) + newPembayaran + code.substring(pIdxEnd);
} else {
    console.log("Could not find Pembayaran Modal block");
}

fs.writeFileSync(path, code, 'utf8');
console.log("Success");
