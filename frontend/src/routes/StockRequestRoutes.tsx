import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const StockRequestsIndex = lazy(() => import('@/pages/stock-requests/index'));
const StockRequestCreate = lazy(() => import('@/pages/stock-requests/create'));
const StockRequestShow = lazy(() => import('@/pages/stock-requests/show'));
const StockRequestEdit = lazy(() => import('@/pages/stock-requests/edit'));
const StockRequestApprove = lazy(() => import('@/pages/stock-requests/approve'));

export function StockRequestRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/stock-requests" element={<ProtectedRoute><StockRequestsIndex /></ProtectedRoute>} />
      <Route path="/stock-requests/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="stock_requests.create">
            <StockRequestCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/stock-requests/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="stock_requests.view">
            <StockRequestShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/stock-requests/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="stock_requests.update">
            <StockRequestEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/stock-requests/:id/approve" element={
        <ProtectedRoute>
          <PermissionGuard permission="stock_requests.approve">
            <StockRequestApprove />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
