import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const StockOpnameIndex = lazy(() => import('@/pages/stock-opname/index'));
const StockOpnameCreate = lazy(() => import('@/pages/stock-opname/create'));
const StockOpnameShow = lazy(() => import('@/pages/stock-opname/show'));
const StockOpnameEdit = lazy(() => import('@/pages/stock-opname/edit'));

export function StockOpnameRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/stock-opname" element={<ProtectedRoute><StockOpnameIndex /></ProtectedRoute>} />
      <Route path="/stock-opname/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="stock_opname.create">
            <StockOpnameCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/stock-opname/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="stock_opname.view">
            <StockOpnameShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/stock-opname/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="stock_opname.update">
            <StockOpnameEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
