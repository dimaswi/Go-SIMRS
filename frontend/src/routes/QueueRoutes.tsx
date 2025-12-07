import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

const QueueIndex = lazy(() => import('@/pages/queues/index'));
const QueueCreate = lazy(() => import('@/pages/queues/create'));

export function QueueRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/queues" element={
        <ProtectedRoute>
          <PermissionGuard permission="queues.view">
            <QueueIndex />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/queues/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="queues.create">
            <QueueCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
