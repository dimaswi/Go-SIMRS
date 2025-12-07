import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const PatientsIndex = lazy(() => import('@/pages/patients/index'));
const PatientsCreate = lazy(() => import('@/pages/patients/create'));
const PatientsShow = lazy(() => import('@/pages/patients/show'));
const PatientsEdit = lazy(() => import('@/pages/patients/edit'));

export function PatientRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/patients" element={
        <ProtectedRoute>
          <PermissionGuard permission="patients.view" redirectTo="/dashboard">
            <PatientsIndex />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/patients/create" element={
        <ProtectedRoute>
          <PatientsCreate />
        </ProtectedRoute>
      } />
      <Route path="/patients/:id" element={
        <ProtectedRoute>
          <PatientsShow />
        </ProtectedRoute>
      } />
      <Route path="/patients/:id/edit" element={
        <ProtectedRoute>
          <PatientsEdit />
        </ProtectedRoute>
      } />
    </>
  );
}
