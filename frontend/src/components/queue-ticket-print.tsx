import { forwardRef } from "react";

interface QueueTicketPrintProps {
  queueNumber: string;
  patientName: string;
  noRM: string;
  roomName: string;
  roomCode: string;
  priority?: string;
  date: string;
  time: string;
}

export const QueueTicketPrint = forwardRef<HTMLDivElement, QueueTicketPrintProps>(
  ({ queueNumber, patientName, noRM, roomName, roomCode, priority, date, time }, ref) => {
    const getPriorityLabel = (priority?: string) => {
      switch (priority) {
        case "emergency":
          return "DARURAT";
        case "urgent":
          return "MENDESAK";
        default:
          return "NORMAL";
      }
    };

    return (
      <div ref={ref} className="hidden print:block">
        <style>{`
          @media print {
            @page {
              size: 80mm 120mm;
              margin: 5mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .print-content {
              width: 70mm;
              font-family: 'Courier New', monospace;
            }
          }
        `}</style>
        
        <div className="print-content p-4">
          <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
            <h1 className="text-xl font-bold">RUMAH SAKIT</h1>
            <p className="text-sm">SIMRS - Hospital</p>
          </div>

          <div className="text-center mb-4">
            <h2 className="text-lg font-bold mb-1">NOMOR ANTRIAN</h2>
            <div className="text-6xl font-bold my-3">{queueNumber}</div>
            {priority && priority !== "normal" && (
              <div className="text-lg font-bold text-red-600 bg-red-100 px-2 py-1 inline-block rounded">
                {getPriorityLabel(priority)}
              </div>
            )}
          </div>

          <div className="border-t-2 border-b-2 border-dashed border-gray-400 py-3 mb-3 text-sm">
            <div className="grid grid-cols-[80px_1fr] gap-1">
              <div>Nama</div>
              <div className="font-semibold">: {patientName}</div>
              
              <div>No. RM</div>
              <div className="font-semibold">: {noRM}</div>
              
              <div>Ruangan</div>
              <div className="font-semibold">: {roomCode} - {roomName}</div>
              
              <div>Tanggal</div>
              <div className="font-semibold">: {date}</div>
              
              <div>Waktu</div>
              <div className="font-semibold">: {time}</div>
            </div>
          </div>

          <div className="text-center text-xs mt-4">
            <p>Mohon menunggu panggilan antrian</p>
            <p>di layar display ruangan</p>
            <p className="mt-2">Terima kasih</p>
          </div>
        </div>
      </div>
    );
  }
);

QueueTicketPrint.displayName = "QueueTicketPrint";
