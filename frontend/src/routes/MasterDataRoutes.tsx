import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const MasterDataIndex = lazy(() => import('@/pages/master-data/index'));
const MasterDataCategory = lazy(() => import('@/pages/master-data/category'));
const MasterDataCreate = lazy(() => import('@/pages/master-data/create'));
const MasterDataEdit = lazy(() => import('@/pages/master-data/edit'));

export function MasterDataRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/master-data" element={<ProtectedRoute><MasterDataIndex /></ProtectedRoute>} />
      <Route path="/master-data/category/:category" element={<ProtectedRoute><MasterDataCategory /></ProtectedRoute>} />
      <Route path="/master-data/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="master_data.create">
            <MasterDataCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/master-data/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="master_data.update">
            <MasterDataEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
