import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

interface CheckInQRCodeProps {
  registrationId: number;
  registrationNumber: string;
  patientName: string;
  scheduledDate?: string;
  roomName?: string;
  doctorName?: string;
  queueNumber?: string;
}

export function CheckInQRCode({
  registrationId,
  registrationNumber,
  patientName,
  scheduledDate,
  roomName,
  doctorName,
  queueNumber,
}: CheckInQRCodeProps) {
  const [open, setOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Generate QR code URL using QR Server API - only registration number
  const qrCodeUrlSmall = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(registrationNumber)}`;
  const qrCodeUrlLarge = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registrationNumber)}`;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Jadwal Kontrol - ${registrationNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; }
            .container { max-width: 400px; margin: 0 auto; text-align: center; }
            .header { margin-bottom: 20px; }
            .header h1 { font-size: 18px; margin-bottom: 5px; }
            .header p { font-size: 12px; color: #666; }
            .qr-box { border: 2px dashed #ccc; padding: 15px; display: inline-block; margin: 15px 0; }
            .qr-box img { width: 150px; height: 150px; }
            .info { margin-top: 15px; }
            .info p { margin: 5px 0; font-size: 14px; }
            .info .name { font-size: 16px; font-weight: bold; }
            .info .reg-no { color: #666; }
            .queue-box { background: #f0f7ff; padding: 10px 20px; border-radius: 8px; margin-top: 15px; display: inline-block; }
            .queue-box .label { font-size: 11px; color: #666; }
            .queue-box .number { font-size: 28px; font-weight: bold; color: #2563eb; }
            .footer { margin-top: 20px; font-size: 11px; color: #999; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>KARTU JADWAL KONTROL</h1>
              <p>SIMRS - Sistem Informasi Manajemen Rumah Sakit</p>
            </div>
            <div class="qr-box">
              <img src="${qrCodeUrlLarge}" alt="QR Code" />
            </div>
            <div class="info">
              <p class="name">${patientName}</p>
              <p class="reg-no">No. Registrasi: ${registrationNumber}</p>
              ${scheduledDate ? `<p>Tanggal: ${new Date(scheduledDate).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>` : ""}
              ${roomName ? `<p>Tujuan: ${roomName}</p>` : ""}
              ${doctorName ? `<p>Dokter: ${doctorName}</p>` : ""}
            </div>
            ${queueNumber ? `
              <div class="queue-box">
                <p class="label">Nomor Antrian (Reserved)</p>
                <p class="number">${queueNumber}</p>
              </div>
            ` : ""}
            <div class="footer">
              <p>Tunjukkan kartu ini atau scan QR code saat check-in</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = qrCodeUrlLarge;
    link.download = `QR-CheckIn-${registrationNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Small clickable QR code */}
      <img
        src={qrCodeUrlSmall}
        alt="QR Code Check-In"
        className="w-16 h-16 cursor-pointer hover:opacity-80 transition-opacity border rounded"
        onClick={() => setOpen(true)}
        title="Klik untuk memperbesar dan print"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kartu Jadwal Kontrol</DialogTitle>
            <DialogDescription>
              Cetak kartu ini untuk diberikan kepada pasien
            </DialogDescription>
          </DialogHeader>

          <div ref={printRef} className="flex flex-col items-center p-4 bg-white border rounded-lg">
            <div className="text-center mb-3">
              <h2 className="font-bold text-base">KARTU JADWAL KONTROL</h2>
              <p className="text-xs text-muted-foreground">SIMRS</p>
            </div>

            <div className="border-2 border-dashed border-primary/50 p-3 rounded-lg bg-white">
              <img
                src={qrCodeUrlLarge}
                alt="QR Code Check-In"
                className="w-36 h-36"
              />
            </div>

            <div className="mt-3 text-center space-y-1">
              <p className="font-semibold">{patientName}</p>
              <p className="text-xs text-muted-foreground">No. Registrasi: {registrationNumber}</p>
              {scheduledDate && (
                <p className="text-sm">
                  Tanggal: {new Date(scheduledDate).toLocaleDateString("id-ID", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
              {roomName && <p className="text-sm">Tujuan: {roomName}</p>}
              {doctorName && <p className="text-sm">Dokter: {doctorName}</p>}
              {queueNumber && (
                <div className="mt-2 px-3 py-1.5 bg-primary/10 rounded-lg inline-block">
                  <p className="text-xs text-muted-foreground">Nomor Antrian</p>
                  <p className="text-xl font-bold text-primary">{queueNumber}</p>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-center text-muted-foreground">
              Tunjukkan kartu ini atau scan QR code saat check-in
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download QR
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Cetak Kartu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
