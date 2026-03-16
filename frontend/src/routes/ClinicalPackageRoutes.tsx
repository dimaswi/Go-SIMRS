import { Route } from 'react-router-dom';
import { lazy, type ComponentType, type ReactNode } from 'react';

const ClinicalPackagesIndex = lazy(() => import('@/pages/clinical-packages/index'));
const ClinicalPackagesCreate = lazy(() => import('@/pages/clinical-packages/create'));
const ClinicalPackagesEdit = lazy(() => import('@/pages/clinical-packages/edit'));
const ClinicalPackagesShow = lazy(() => import('@/pages/clinical-packages/show'));

export function ClinicalPackageRoutes(ProtectedRoute: ComponentType<{ children: ReactNode }>) {
  return (
    <>
      <Route path="/clinical-packages" element={<ProtectedRoute><ClinicalPackagesIndex /></ProtectedRoute>} />
      <Route path="/clinical-packages/create" element={<ProtectedRoute><ClinicalPackagesCreate /></ProtectedRoute>} />
      <Route path="/clinical-packages/:id" element={<ProtectedRoute><ClinicalPackagesShow /></ProtectedRoute>} />
      <Route path="/clinical-packages/:id/edit" element={<ProtectedRoute><ClinicalPackagesEdit /></ProtectedRoute>} />
    </>
  );
}