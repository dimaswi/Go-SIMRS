import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { roomQueuesApi } from '@/lib/api/room-queues';
import type { RoomQueue, RoomQueueStats } from '@/lib/api/room-queues';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Clock, CheckCircle, XCircle, Pause, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
      toast({
        title: 'Queue Called',
        description: `Queue ${response.data.queue_number} has been called`,
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
      toast({
        title: 'Queue Called',
        description: `Queue ${response.data.queue_number} has been called`,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Room Queue Management</h1>
          <p className="text-muted-foreground">
            Manage patient queues for this room
          </p>
        </div>
        <Button onClick={handleCallNext} size="lg">
          <Phone className="mr-2 h-4 w-4" />
          Call Next Patient
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Queues</CardDescription>
              <CardTitle className="text-3xl">{stats.total_queues}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Waiting</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{stats.waiting_queues}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Serving</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.serving_queues}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Wait Time</CardDescription>
              <CardTitle className="text-3xl">
                {Math.round(stats.average_wait_time_minutes || 0)} min
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Current Queue Display */}
      {currentQueue && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Currently Serving
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Queue Number</p>
                <p className="text-4xl font-bold">{currentQueue.queue_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Patient Name</p>
                <p className="text-2xl font-semibold">
                  {currentQueue.visit?.registration?.patient?.nama_lengkap || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">RM Number</p>
                <p className="text-2xl font-semibold">
                  {currentQueue.visit?.registration?.patient?.no_rm || '-'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => handleUpdateStatus(currentQueue.id, 'serving')}
                disabled={currentQueue.status === 'serving'}
              >
                Start Serving
              </Button>
              <Button
                onClick={() => handleUpdateStatus(currentQueue.id, 'completed')}
                variant="outline"
              >
                Complete
              </Button>
              <Button
                onClick={() => handleUpdateStatus(currentQueue.id, 'skipped')}
                variant="outline"
              >
                Skip
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
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

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Queue List</CardTitle>
          <CardDescription>All queues for today ({today})</CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No queues found
                  </TableCell>
                </TableRow>
              ) : (
                queues.map((queue) => (
                  <TableRow key={queue.id}>
                    <TableCell className="font-bold text-lg">{queue.queue_number}</TableCell>
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
                            onClick={() => handleCallSpecific(queue.id)}
                          >
                            Call
                          </Button>
                        )}
                        {queue.status === 'called' && (
                          <Button
                            size="sm"
                            onClick={() => handleUpdateStatus(queue.id, 'serving')}
                          >
                            Serve
                          </Button>
                        )}
                        {queue.status === 'serving' && (
                          <Button
                            size="sm"
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
        </CardContent>
      </Card>
    </div>
  );
}
