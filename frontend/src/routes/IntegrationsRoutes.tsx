import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

// Lazy load components
const IntegrationsConfig = lazy(() => import('@/pages/integrations/config'));
const SatuSehatSender = lazy(() => import('@/pages/integrations/satusehat-sender'));
const SatuSehatLogs = lazy(() => import('@/pages/integrations/satusehat-logs'));

// BPJS Pages
const BPJSMapping = lazy(() => import('@/pages/bpjs/mapping/index'));
const BPJSLogs = lazy(() => import('@/pages/bpjs/logs'));
const BPJSAPITester = lazy(() => import('@/pages/bpjs/api-tester'));
const BPJSQueueMonitoring = lazy(() => import('@/pages/bpjs/queue-monitoring'));
const BPJSTools = lazy(() => import('@/pages/bpjs/tools'));

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

      {/* BPJS Routes */}
      <Route path="/bpjs/mapping" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <BPJSMapping />
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
      <Route path="/bpjs/queue-monitoring" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <BPJSQueueMonitoring />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/bpjs/tools" element={
        <ProtectedRoute>
          <PermissionGuard permission="integrations.view">
            <BPJSTools />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
