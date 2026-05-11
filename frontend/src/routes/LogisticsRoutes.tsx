import { Route } from 'react-router-dom';
import { lazy } from 'react';

const LogisticsDashboard = lazy(() => import('@/pages/logistics/index'));

export function LogisticsRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/logistics" element={<ProtectedRoute><LogisticsDashboard /></ProtectedRoute>} />
    </>
  );
}