import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const InventoriesIndex = lazy(() => import('@/pages/inventories/index'));
const InventoriesShow = lazy(() => import('@/pages/inventories/show'));
const InventoriesCreate = lazy(() => import('@/pages/inventories/create'));
const InventoriesEdit = lazy(() => import('@/pages/inventories/edit'));

export function InventoryRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/inventories" element={<ProtectedRoute><InventoriesIndex /></ProtectedRoute>} />
      <Route path="/inventories/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="inventories.create">
            <InventoriesCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/inventories/:id" element={<ProtectedRoute><InventoriesShow /></ProtectedRoute>} />
      <Route path="/inventories/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="inventories.update">
            <InventoriesEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
