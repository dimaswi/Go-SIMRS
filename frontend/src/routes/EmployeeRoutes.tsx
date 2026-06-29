import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const EmployeesIndex = lazy(() => import('@/pages/employees/index'));
const EmployeesShow = lazy(() => import('@/pages/employees/show'));
const EmployeesCreate = lazy(() => import('@/pages/employees/create'));
const EmployeesEdit = lazy(() => import('@/pages/employees/edit'));

export function EmployeeRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/employees" element={
        <ProtectedRoute>
          <PermissionGuard permission="employees.view">
            <EmployeesIndex />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/employees/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="employees.create">
            <EmployeesCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/employees/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="employees.view">
            <EmployeesShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/employees/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="employees.update">
            <EmployeesEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
