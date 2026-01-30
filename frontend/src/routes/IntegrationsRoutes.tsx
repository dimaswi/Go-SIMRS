import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const IntegrationsConfig = lazy(() => import('@/pages/integrations/config'));
const SatuSehatSender = lazy(() => import('@/pages/integrations/satusehat-sender'));
const SatuSehatLogs = lazy(() => import('@/pages/integrations/satusehat-logs'));

// BPJS Mapping
const BPJSPoliMapping = lazy(() => import('@/pages/bpjs/mapping/poli'));
const BPJSDoctorMapping = lazy(() => import('@/pages/bpjs/mapping/dokter'));
const BPJSLogs = lazy(() => import('@/pages/bpjs/logs'));
const BPJSAPITester = lazy(() => import('@/pages/bpjs/api-tester'));

export function IntegrationsRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/integrations/config" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <IntegrationsConfig />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/integrations/satusehat" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <SatuSehatSender />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/integrations/satusehat/send" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.manage">
            <SatuSehatSender />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/integrations/satusehat/logs" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <SatuSehatLogs />
          </PermissionGuard>
        </ProtectedRoute>
      } />

      {/* BPJS Mapping Routes */}
      <Route path="/bpjs/mapping/poli" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <BPJSPoliMapping />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/bpjs/mapping/dokter" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <BPJSDoctorMapping />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/bpjs/logs" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <BPJSLogs />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/bpjs/api-tester" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <BPJSAPITester />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
