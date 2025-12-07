import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

const RoomQueueManagement = lazy(() => import('@/pages/room-queue/index'));
const RoomQueueDisplay = lazy(() => import('@/pages/room-queue/display'));

export function RoomQueueRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Management route with path param - Protected */}
      <Route path="/room-queue/room/:roomId" element={
        <ProtectedRoute>
          <PermissionGuard permission="rooms.view">
            <RoomQueueManagement />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      
      {/* Display route with path param - Public */}
      <Route path="/room-queue/display/:roomId" element={<RoomQueueDisplay />} />
    </>
  );
}
