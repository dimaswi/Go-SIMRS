import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Loader2, Send, CheckCircle, AlertCircle, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

interface Room {
  id: number;
  code: string;
  name: string;
  room_type: string;
  satusehat_id?: string;
}

interface SendResponse {
  type: 'location' | 'encounter' | 'patient' | 'practitioner' | 'condition';
  success: boolean;
  title: string;
  data: Record<string, unknown>;
}

interface LocationsTabProps {
  rooms: Room[];
  sending: string | null;
  onSendLocation: (roomId: number) => void;
  onShowResponse: (response: SendResponse) => void;
}

export function LocationsTab({ rooms, sending, onSendLocation, onShowResponse }: LocationsTabProps) {
  const roomColumns: ColumnDef<Room>[] = [
    {
      accessorKey: "code",
      header: "Kode",
      cell: ({ row }) => <span className="font-mono">{row.original.code}</span>,
    },
    {
      accessorKey: "name",
      header: "Nama Ruangan",
    },
    {
      accessorKey: "room_type",
      header: "Tipe",
      cell: ({ row }) => <Badge variant="outline">{row.original.room_type}</Badge>,
    },
    {
      accessorKey: "satusehat_id",
      header: "Status SatuSehat",
      cell: ({ row }) => {
        const room = row.original;
        if (room.satusehat_id) {
          return (
            <div className="flex flex-col gap-1">
              <Badge className="bg-green-100 text-green-800 gap-1 hover:bg-green-200 w-fit">
                <CheckCircle className="h-3 w-3" />
                Terkirim
              </Badge>
              <code className="text-xs text-muted-foreground font-mono truncate max-w-[150px]" title={room.satusehat_id}>
                {room.satusehat_id}
              </code>
            </div>
          );
        }
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-normal gap-1">
            <AlertCircle className="h-3 w-3" />
            Belum Dikirim
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const room = row.original;
        return (
          <div className="text-right">
            {room.satusehat_id ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onShowResponse({
                    type: 'location',
                    success: true,
                    title: `Location: ${room.name}`,
                    data: {
                      message: 'Data sudah terkirim sebelumnya',
                      room_id: room.id,
                      room_name: room.name,
                      room_code: room.code,
                      satusehat_id: room.satusehat_id,
                    },
                  });
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Detail
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSendLocation(room.id)}
                disabled={sending === `room-${room.id}`}
              >
                {sending === `room-${room.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Kirim
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={roomColumns}
      data={[...rooms].sort((a, b) => a.name.localeCompare(b.name))}
      searchPlaceholder="Cari nama atau kode ruangan..."
      pageSize={10}
      tableId="satusehat-locations"
    />
  );
}
