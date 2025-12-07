import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, SkipForward, XCircle, UserPlus, Volume2 } from "lucide-react";
import type { Queue } from "@/lib/api/queue";
import { queueStatusLabels, queueTypeLabels } from "@/lib/api/queue";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface ColumnOptions {
  onCall: (id: number) => void;
  onRecall: (id: number) => void;
  onSkip: (id: number) => void;
  onCancel: (id: number) => void;
  onRegister: (queue: Queue) => void;
  hasCallPermission: boolean;
  hasDeletePermission: boolean;
  hasRegisterPermission: boolean;
}

const statusColors: Record<string, string> = {
  waiting: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  called: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  serving: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  skipped: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const typeColors: Record<string, string> = {
  general: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  bpjs: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  emergency: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function createQueueColumns(options: ColumnOptions): ColumnDef<Queue>[] {
  return [
    {
      accessorKey: "queue_number",
      header: "No. Antrean",
      cell: ({ row }) => (
        <span className="font-bold text-lg">{row.original.queue_number}</span>
      ),
    },
    {
      accessorKey: "queue_type",
      header: "Jenis",
      cell: ({ row }) => (
        <Badge className={typeColors[row.original.queue_type]}>
          {queueTypeLabels[row.original.queue_type]}
        </Badge>
      ),
    },
    {
      accessorKey: "counter_id",
      header: "Loket",
      cell: ({ row }) => {
        const counter = row.original.counter;
        return counter ? (
          <span className="font-medium">{counter.name}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={statusColors[row.original.status]}>
          {queueStatusLabels[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: "called_at",
      header: "Waktu Panggil",
      cell: ({ row }) => {
        const calledAt = row.original.called_at;
        return calledAt
          ? format(new Date(calledAt), "HH:mm", { locale: localeId })
          : "-";
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const queue = row.original;
        return (
          <div className="flex justify-end gap-1">
            {queue.status === "waiting" && options.hasCallPermission && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => options.onCall(queue.id)}
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
            {queue.status === "called" && (
              <>
                {options.hasCallPermission && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => options.onRecall(queue.id)}
                    className="bg-yellow-500 hover:bg-yellow-600"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                )}
                {options.hasRegisterPermission && (
                  <Button
                    size="sm"
                    onClick={() => options.onRegister(queue)}
                  >
                    <UserPlus className="mr-1 h-4 w-4" />
                    Daftar
                  </Button>
                )}
                {options.hasCallPermission && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => options.onSkip(queue.id)}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {(queue.status === "waiting" || queue.status === "skipped") &&
              options.hasDeletePermission && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => options.onCancel(queue.id)}
                >
                  <XCircle className="h-4 w-4 text-destructive" />
                </Button>
              )}
          </div>
        );
      },
    },
  ];
}
