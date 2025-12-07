import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const ProceduresIndex = lazy(() => import('@/pages/procedures/index'));
const ProceduresShow = lazy(() => import('@/pages/procedures/show'));
const ProceduresCreate = lazy(() => import('@/pages/procedures/create'));
const ProceduresEdit = lazy(() => import('@/pages/procedures/edit'));

export function ProcedureRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/procedures" element={<ProtectedRoute><ProceduresIndex /></ProtectedRoute>} />
      <Route path="/procedures/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="procedures.create">
            <ProceduresCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/procedures/:id" element={<ProtectedRoute><ProceduresShow /></ProtectedRoute>} />
      <Route path="/procedures/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="procedures.update">
            <ProceduresEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
