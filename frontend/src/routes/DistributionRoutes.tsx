import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const DistributionsIndex = lazy(() => import('@/pages/distributions/index'));
const DistributionCreate = lazy(() => import('@/pages/distributions/create'));
const DistributionShow = lazy(() => import('@/pages/distributions/show'));
const DistributionEdit = lazy(() => import('@/pages/distributions/edit'));

export function DistributionRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/distributions" element={<ProtectedRoute><DistributionsIndex /></ProtectedRoute>} />
      <Route path="/distributions/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="distributions.create">
            <DistributionCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/distributions/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="distributions.view">
            <DistributionShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/distributions/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="distributions.update">
            <DistributionEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
