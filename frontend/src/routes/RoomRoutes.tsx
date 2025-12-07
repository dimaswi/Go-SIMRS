import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const RoomsIndex = lazy(() => import('@/pages/rooms/index'));
const RoomsShow = lazy(() => import('@/pages/rooms/show'));
const RoomsCreate = lazy(() => import('@/pages/rooms/create'));
const RoomsEdit = lazy(() => import('@/pages/rooms/edit'));

export function RoomRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/rooms" element={<ProtectedRoute><RoomsIndex /></ProtectedRoute>} />
      <Route path="/rooms/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="rooms.create">
            <RoomsCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/rooms/:id" element={<ProtectedRoute><RoomsShow /></ProtectedRoute>} />
      <Route path="/rooms/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="rooms.update">
            <RoomsEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
