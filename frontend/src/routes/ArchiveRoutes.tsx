import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const ArchivesIndex = lazy(() => import('@/pages/archives/index'));
const ArchiveViewer = lazy(() => import('@/pages/archives/viewer'));

export function ArchiveRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/archives" element={
        <ProtectedRoute>
          <PermissionGuard permission="archives.view" redirectTo="/dashboard">
            <ArchivesIndex />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/archives/viewer/:patientId" element={
        <ProtectedRoute>
          <PermissionGuard permission="archives.view" redirectTo="/dashboard">
            <ArchiveViewer />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
