import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const PurchasesIndex = lazy(() => import('@/pages/purchases/index'));
const PurchasePayablesIndex = lazy(() => import('@/pages/purchases/payables'));
const PurchaseCreate = lazy(() => import('@/pages/purchases/create'));
const PurchaseShow = lazy(() => import('@/pages/purchases/show'));
const PurchaseEdit = lazy(() => import('@/pages/purchases/edit'));
const PurchaseReceive = lazy(() => import('@/pages/purchases/receive'));

export function PurchaseRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/purchases" element={<ProtectedRoute><PurchasesIndex /></ProtectedRoute>} />
      <Route path="/purchases/payables" element={
        <ProtectedRoute>
          <PermissionGuard permission="purchases.view">
            <PurchasePayablesIndex />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/purchases/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="purchases.create">
            <PurchaseCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/purchases/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="purchases.view">
            <PurchaseShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/purchases/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="purchases.update">
            <PurchaseEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/purchases/:id/receive" element={
        <ProtectedRoute>
          <PermissionGuard permission="purchases.receive">
            <PurchaseReceive />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
