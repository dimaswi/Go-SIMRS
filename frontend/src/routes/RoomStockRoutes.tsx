import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

const RoomMedicinePage = lazy(() => import('@/pages/room-stock/medicines'));
const RoomInventoryPage = lazy(() => import('@/pages/room-stock/inventories'));
const AdjustMedicineStockPage = lazy(() => import('@/pages/room-stock/adjust-medicine'));
const AdjustInventoryStockPage = lazy(() => import('@/pages/room-stock/adjust-inventory'));

export function RoomStockRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Room Medicine Stock */}
      <Route
        path="/room-stock/medicines"
        element={
          <ProtectedRoute>
            <PermissionGuard permission="room-medicines.view">
              <RoomMedicinePage />
            </PermissionGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/room-stock/medicines/:id/adjust"
        element={
          <ProtectedRoute>
            <PermissionGuard permission="room-medicines.update">
              <AdjustMedicineStockPage />
            </PermissionGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/room-stock/medicines/:id/edit"
        element={
          <ProtectedRoute>
            <PermissionGuard permission="room-medicines.update">
              <AdjustMedicineStockPage />
            </PermissionGuard>
          </ProtectedRoute>
        }
      />

      {/* Room Inventory Stock */}
      <Route
        path="/room-stock/inventories"
        element={
          <ProtectedRoute>
            <PermissionGuard permission="room-inventories.view">
              <RoomInventoryPage />
            </PermissionGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/room-stock/inventories/:id/adjust"
        element={
          <ProtectedRoute>
            <PermissionGuard permission="room-inventories.update">
              <AdjustInventoryStockPage />
            </PermissionGuard>
          </ProtectedRoute>
        }
      />
      <Route
        path="/room-stock/inventories/:id/edit"
        element={
          <ProtectedRoute>
            <PermissionGuard permission="room-inventories.update">
              <AdjustInventoryStockPage />
            </PermissionGuard>
          </ProtectedRoute>
        }
      />
    </>
  );
}
