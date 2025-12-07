import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const MedicinesIndex = lazy(() => import('@/pages/medicines/index'));
const MedicinesShow = lazy(() => import('@/pages/medicines/show'));
const MedicinesCreate = lazy(() => import('@/pages/medicines/create'));
const MedicinesEdit = lazy(() => import('@/pages/medicines/edit'));

export function MedicineRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/medicines" element={<ProtectedRoute><MedicinesIndex /></ProtectedRoute>} />
      <Route path="/medicines/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="medicines.create">
            <MedicinesCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/medicines/:id" element={<ProtectedRoute><MedicinesShow /></ProtectedRoute>} />
      <Route path="/medicines/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="medicines.update">
            <MedicinesEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
