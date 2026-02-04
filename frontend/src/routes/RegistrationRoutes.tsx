import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

const RegistrationIndex = lazy(() => import('@/pages/registrations/index'));
const RegistrationCreate = lazy(() => import('@/pages/registrations/create'));
const RegistrationShow = lazy(() => import('@/pages/registrations/show'));
const ScheduledRegistrations = lazy(() => import('@/pages/registrations/scheduled'));

export function RegistrationRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/registrations" element={
        <ProtectedRoute>
          <PermissionGuard permission="registrations.view">
            <RegistrationIndex />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/registrations/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="registrations.create">
            <RegistrationCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/registrations/show/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="registrations.view">
            <RegistrationShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/registrations/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="registrations.view">
            <RegistrationShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/registrations/scheduled" element={
        <ProtectedRoute>
          <PermissionGuard permission="registrations.view">
            <ScheduledRegistrations />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
