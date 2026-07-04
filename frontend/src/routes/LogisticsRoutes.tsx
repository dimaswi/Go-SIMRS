import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { AnyPermissionRoute } from '@/components/protected-route';

const LogisticsDashboard = lazy(() => import('@/pages/logistics/index'));

const LOGISTICS_ACCESS_PERMISSIONS = [
  'medicines.view',
  'inventories.view',
  'suppliers.view',
  'stock_requests.view',
  'distributions.view',
  'purchases.view',
  'stock_opname.view',
  'room-medicines.view',
  'room-inventories.view',
];

export function LogisticsRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/logistics" element={
        <ProtectedRoute>
          <AnyPermissionRoute permissions={LOGISTICS_ACCESS_PERMISSIONS}>
            <LogisticsDashboard />
          </AnyPermissionRoute>
        </ProtectedRoute>
      } />
    </>
  );
}
