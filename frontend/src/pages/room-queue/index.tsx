import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { roomQueuesApi } from '@/lib/api/room-queues';
import type { RoomQueue, RoomQueueStats } from '@/lib/api/room-queues';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Clock, CheckCircle, XCircle, Pause, AlertCircle, Smartphone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatPatientName } from '@/lib/print-utils';
import { queueSharedAnnouncement } from '@/lib/shared-queue-announcer';

const INDONESIAN_SPEECH_MAP: Record<string, string> = {
  A: 'a',
  B: 'be',
  C: 'ce',
  D: 'de',
  E: 'e',
  F: 'ef',
  G: 'ge',
  H: 'ha',
  I: 'i',
  J: 'je',
  K: 'ka',
  L: 'el',
  M: 'em',
  N: 'en',
  O: 'o',
  P: 'pe',
  Q: 'kiu',
  R: 'er',
  S: 'es',
  T: 'te',
  U: 'u',
  V: 've',
  W: 'we',
  X: 'eks',
  Y: 'ye',
  Z: 'zet',
  '0': 'nol',
  '1': 'satu',
  '2': 'dua',
  '3': 'tiga',
  '4': 'empat',
  '5': 'lima',
  '6': 'enam',
  '7': 'tujuh',
  '8': 'delapan',
  '9': 'sembilan',
};

const spellQueueNumberForSpeech = (value: string) =>
  value
    .trim()
    .split('')
    .map((char) => INDONESIAN_SPEECH_MAP[char.toUpperCase()] || '')
    .filter(Boolean)
    .join(' ');

const getRoomQueueAnnouncementVersion = (queue: RoomQueue) =>
  queue.called_at || queue.updated_at || queue.created_at || new Date().toISOString();

export default function RoomQueueManagement() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const queryRoomId = searchParams.get('room_id');
  const roomId = paramRoomId || queryRoomId;

  const [queues, setQueues] = useState<RoomQueue[]>([]);
  const [stats, setStats] = useState<RoomQueueStats | null>(null);
  const [currentQueue, setCurrentQueue] = useState<RoomQueue | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Format tanggal ke string yyyy-MM-dd (dari browser timezone lokal)
  const getTodayString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getTodayString();

  const buildRoomAnnouncementText = (queue: RoomQueue) => {
    const queueText = spellQueueNumberForSpeech(queue.queue_number);
    const roomName = queue.room?.name || `ruangan ${roomId}`;
    return `Nomor antrean ${queueText}. Silakan menuju ${roomName}.`;
  };

  const fetchData = async () => {
    if (!roomId) return;

    try {
      const [queuesData, statsData] = await Promise.all([
        roomQueuesApi.getAll({
          room_id: parseInt(roomId),
          date: today,
          status: statusFilter === 'all' ? undefined : statusFilter,
        }),
        roomQueuesApi.getStats(parseInt(roomId), today),
      ]);

      setQueues(queuesData.data);
      setStats(statsData.data);

      // Try to get current queue
      try {
        const current = await roomQueuesApi.getCurrent(parseInt(roomId));
        setCurrentQueue(current.data);
      } catch {
        setCurrentQueue(null);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to fetch queue data',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [roomId, statusFilter]);

  const handleCallNext = async () => {
    if (!roomId) return;

    try {
      const response = await roomQueuesApi.callNext(parseInt(roomId));
      const calledQueue = response.data;

      if (calledQueue) {
        queueSharedAnnouncement({
          id: `${calledQueue.id}-${getRoomQueueAnnouncementVersion(calledQueue)}`,
          kind: 'room',
          speechText: buildRoomAnnouncementText(calledQueue),
        });
      }

      toast({
        title: 'Queue Called',
        description: `Queue ${calledQueue.queue_number} has been called`,
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to call next queue',
        variant: 'destructive',
      });
    }
  };

  const handleCallSpecific = async (id: number) => {
    try {
      const response = await roomQueuesApi.callQueue(id);
      const calledQueue = response.data;

      if (calledQueue) {
        queueSharedAnnouncement({
          id: `${calledQueue.id}-${getRoomQueueAnnouncementVersion(calledQueue)}`,
          kind: 'room',
          speechText: buildRoomAnnouncementText(calledQueue),
        });
      }

      toast({
        title: 'Queue Called',
        description: `Queue ${calledQueue.queue_number} has been called`,
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to call queue',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await roomQueuesApi.updateStatus(id, { status });
      toast({
        title: 'Status Updated',
        description: `Queue status updated to ${status}`,
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      reserved: { variant: 'outline', icon: Smartphone, label: 'Reserved (MJKN)' },
      waiting: { variant: 'secondary', icon: Clock, label: 'Waiting' },
      called: { variant: 'default', icon: Phone, label: 'Called' },
      serving: { variant: 'default', icon: AlertCircle, label: 'Serving' },
      completed: { variant: 'default', icon: CheckCircle, label: 'Completed' },
      skipped: { variant: 'outline', icon: Pause, label: 'Skipped' },
      cancelled: { variant: 'destructive', icon: XCircle, label: 'Cancelled' },
    };

    const config = variants[status] || variants.waiting;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      emergency: 'bg-red-500 hover:bg-red-600',
      urgent: 'bg-orange-500 hover:bg-orange-600',
      normal: 'bg-blue-500 hover:bg-blue-600',
    };

    return (
      <Badge className={colors[priority] || colors.normal}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  return (
    <PageShell>
      <PageHeader
        icon={Phone}
        title="Room Queue Management"
        description="Manage patient queues for this room"
        count={queues.length}
        actions={
          <Button onClick={handleCallNext} size="sm" className="h-8 rounded-none text-xs">
            <Phone className="mr-1.5 h-3.5 w-3.5" />
            Call Next Patient
          </Button>
        }
      />

      {/* Statistics KPI Strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="px-4 py-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Total Queues</div>
            <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">{stats.total_queues}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Waiting</div>
            <div className="mt-1 text-2xl font-bold text-yellow-600">{stats.waiting_queues}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Serving</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">{stats.serving_queues}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Avg Wait Time</div>
            <div className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">
              {Math.round(stats.average_wait_time_minutes || 0)} min
            </div>
          </div>
        </div>
      )}

      <PageContent className="space-y-4">
        {/* Current Queue Display */}
        {currentQueue && (
          <section className="space-y-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                <Phone className="h-4 w-4 text-neutral-500" />
                Currently Serving
              </h3>
            </div>
            <div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-mono uppercase text-muted-foreground">Queue Number</p>
                  <p className="text-3xl font-bold">{currentQueue.queue_number}</p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-muted-foreground">Patient Name</p>
                  <p className="text-xl font-semibold">
                    {formatPatientName(currentQueue.visit?.registration?.patient?.nama_lengkap, currentQueue.visit?.registration?.patient?.jenis_kelamin, undefined, currentQueue.visit?.registration?.patient?.tanggal_lahir) || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-muted-foreground">RM Number</p>
                  <p className="text-xl font-semibold">
                    {currentQueue.visit?.registration?.patient?.no_rm || '-'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => handleUpdateStatus(currentQueue.id, 'serving')}
                  disabled={currentQueue.status === 'serving'}
                  className="rounded-none"
                >
                  Start Serving
                </Button>
                <Button
                  onClick={() => handleUpdateStatus(currentQueue.id, 'completed')}
                  variant="outline"
                  className="rounded-none"
                >
                  Complete
                </Button>
                <Button
                  onClick={() => handleUpdateStatus(currentQueue.id, 'skipped')}
                  variant="outline"
                  className="rounded-none"
                >
                  Skip
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Filter & Queue Table */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 px-4 py-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Queue List ({today})</h3>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[180px] rounded-none border-neutral-200 dark:border-neutral-800 text-xs">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="called">Called</SelectItem>
                <SelectItem value="serving">Serving</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue No</TableHead>
                  <TableHead>Patient Name</TableHead>
                  <TableHead>RM Number</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in Time</TableHead>
                  <TableHead>Called At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No queues found
                    </TableCell>
                  </TableRow>
                ) : (
                  queues.map((queue) => (
                    <TableRow key={queue.id}>
                      <TableCell className="font-bold text-lg">
                        <div className="flex items-center gap-2">
                          {queue.queue_number}
                          {queue.is_mjkn && (
                            <Badge variant="outline" className="rounded-none bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
                              <Smartphone className="h-3 w-3" />
                              MJKN
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{queue.visit?.registration?.patient?.nama_lengkap || '-'}</TableCell>
                      <TableCell>{queue.visit?.registration?.patient?.no_rm || '-'}</TableCell>
                      <TableCell>{getPriorityBadge(queue.priority)}</TableCell>
                      <TableCell>{getStatusBadge(queue.status)}</TableCell>
                      <TableCell>
                        {queue.visit?.check_in_time
                          ? format(new Date(queue.visit.check_in_time), 'HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {queue.called_at ? format(new Date(queue.called_at), 'HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {queue.status === 'waiting' && (
                            <Button
                              size="sm"
                              className="rounded-none"
                              onClick={() => handleCallSpecific(queue.id)}
                            >
                              Call
                            </Button>
                          )}
                          {queue.status === 'called' && (
                            <Button
                              size="sm"
                              className="rounded-none"
                              onClick={() => handleUpdateStatus(queue.id, 'serving')}
                            >
                              Serve
                            </Button>
                          )}
                          {queue.status === 'serving' && (
                            <Button
                              size="sm"
                              className="rounded-none"
                              onClick={() => handleUpdateStatus(queue.id, 'completed')}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
