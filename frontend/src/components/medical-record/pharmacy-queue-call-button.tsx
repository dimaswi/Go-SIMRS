import React, { useState, useEffect, useCallback } from "react";
import { Volume2, PhoneCall, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { roomQueuesApi, visitsApi } from "@/lib/api";
import type { RoomQueue } from "@/lib/api/room-queues";
import type { MedicineOrder } from "@/lib/api/medicine-orders";
import { queueSharedAnnouncement } from "@/lib/shared-queue-announcer";
import { cn } from "@/lib/utils";

const INDONESIAN_SPEECH_MAP: Record<string, string> = {
  A: "a", B: "be", C: "ce", D: "de", E: "e", F: "ef", G: "ge", H: "ha",
  I: "i", J: "je", K: "ka", L: "el", M: "em", N: "en", O: "o", P: "pe",
  Q: "kiu", R: "er", S: "es", T: "te", U: "u", V: "ve", W: "we", X: "eks",
  Y: "ye", Z: "zet",
  "0": "nol", "1": "satu", "2": "dua", "3": "tiga", "4": "empat",
  "5": "lima", "6": "enam", "7": "tujuh", "8": "delapan", "9": "sembilan",
};

const spellQueueNumberForSpeech = (value: string) =>
  value
    .trim()
    .split("")
    .map((char) => INDONESIAN_SPEECH_MAP[char.toUpperCase()] || "")
    .filter(Boolean)
    .join(" ");

const getRoomQueueAnnouncementVersion = (queue: {
  id: number;
  called_at?: string;
  updated_at?: string;
  created_at?: string;
}) => queue.called_at || queue.updated_at || queue.created_at || new Date().toISOString();

export interface PharmacyQueueCallButtonProps {
  visitId?: number;
  initialQueue?: RoomQueue | null;
  order?: MedicineOrder | null;
  patientName?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary";
  showQueueNumber?: boolean;
  iconOnly?: boolean;
  onQueueCalled?: (queue: RoomQueue) => void;
}

export function PharmacyQueueCallButton({
  visitId,
  initialQueue,
  order,
  patientName,
  className,
  size = "sm",
  variant,
  showQueueNumber = true,
  iconOnly = false,
  onQueueCalled,
}: PharmacyQueueCallButtonProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [calling, setCalling] = useState(false);
  const [queue, setQueue] = useState<any>(initialQueue || null);

  const canCall = hasPermission("room_queues.call");

  // Sync queue from initialQueue, order, or visit
  useEffect(() => {
    let active = true;

    if (initialQueue) {
      setQueue(initialQueue);
      return;
    }

    if (order?.pharmacy_visit?.room_queue) {
      setQueue(order.pharmacy_visit.room_queue);
      return;
    }

    if (visitId) {
      void visitsApi
        .getById(visitId)
        .then((res) => {
          if (active && res.data?.room_queue) {
            setQueue(res.data.room_queue);
          }
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [initialQueue, order?.pharmacy_visit?.room_queue, visitId]);

  const handleCall = useCallback(
    async (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();

      if (!queue?.id || calling) return;

      setCalling(true);
      try {
        const response = await roomQueuesApi.callQueue(queue.id);
        const updated = response.data || { ...queue, status: "called" };
        setQueue(updated);

        const roomName =
          updated.room?.name ||
          order?.pharmacy_room?.name ||
          order?.pharmacy_visit?.room?.name ||
          "Farmasi";

        queueSharedAnnouncement({
          id: `${updated.id}-${getRoomQueueAnnouncementVersion(updated)}`,
          kind: "room",
          speechText: `Nomor antrean ${spellQueueNumberForSpeech(updated.queue_number)}. Silakan menuju ${roomName}.`,
        });

        const isRecall = queue.status === "called";
        toast({
          title: isRecall ? "Antrean Dipanggil Ulang" : "Antrean Dipanggil",
          description: `Nomor antrean ${updated.queue_number} ${
            patientName ? `- ${patientName}` : ""
          } dipanggil ke ${roomName}`,
        });

        onQueueCalled?.(updated);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.response?.data?.error || "Gagal memanggil antrean",
        });
      } finally {
        setCalling(false);
      }
    },
    [calling, queue, order, patientName, onQueueCalled, toast],
  );

  if (!canCall || !queue?.id) {
    return null;
  }

  // If completed or cancelled, don't show active calling button
  if (queue.status === "completed" || queue.status === "cancelled") {
    return null;
  }

  const isCalled = queue.status === "called";
  const defaultVariant = isCalled ? "outline" : "default";
  const buttonVariant = variant || defaultVariant;

  if (iconOnly) {
    const iconOnlyVariant = variant || "outline";
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={iconOnlyVariant}
              size="icon"
              onClick={handleCall}
              disabled={calling}
              className={cn(
                "h-8 w-8 rounded-none transition-colors",
                isCalled
                  ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950"
                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50",
                className,
              )}
              title={isCalled ? `Panggil Ulang Antrean (${queue.queue_number})` : `Panggil Antrean (${queue.queue_number})`}
              aria-label={isCalled ? `Panggil Ulang Antrean (${queue.queue_number})` : `Panggil Antrean (${queue.queue_number})`}
            >
              {calling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isCalled ? (
                <PhoneCall className="h-4 w-4 text-amber-500" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {isCalled
              ? `Nomor antrean ${queue.queue_number} sudah dipanggil. Klik untuk memanggil ulang.`
              : `Panggil antrean ${queue.queue_number} ke loket farmasi.`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const buttonText = calling ? (
    "Memanggil..."
  ) : isCalled ? (
    <>
      <PhoneCall className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
      Panggil Ulang {showQueueNumber && queue.queue_number ? `(${queue.queue_number})` : ""}
    </>
  ) : (
    <>
      <Volume2 className="h-3.5 w-3.5 mr-1.5" />
      Panggil Antrean {showQueueNumber && queue.queue_number ? `(${queue.queue_number})` : ""}
    </>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={buttonVariant}
            size={size}
            onClick={handleCall}
            disabled={calling}
            className={cn(
              "font-medium transition-colors",
              isCalled
                ? "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
              className,
            )}
            title={isCalled ? "Panggil Ulang Antrean" : "Panggil Antrean Pasien"}
          >
            {calling && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {buttonText}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {isCalled
            ? `Nomor antrean ${queue.queue_number} sudah dipanggil. Klik untuk memanggil ulang.`
            : `Panggil nomor antrean ${queue.queue_number} ke loket farmasi.`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
