import { Route } from 'react-router-dom';
import { lazy } from 'react';

// Lazy load components
const RegionsIndex = lazy(() => import('@/pages/regions/index'));
const ProvinceCreate = lazy(() => import('@/pages/regions/provinces/create'));
const ProvinceShow = lazy(() => import('@/pages/regions/provinces/show'));
const ProvinceEdit = lazy(() => import('@/pages/regions/provinces/edit'));
const RegencyCreate = lazy(() => import('@/pages/regions/regencies/create'));
const RegencyShow = lazy(() => import('@/pages/regions/regencies/show'));
const RegencyEdit = lazy(() => import('@/pages/regions/regencies/edit'));
const DistrictCreate = lazy(() => import('@/pages/regions/districts/create'));
const DistrictShow = lazy(() => import('@/pages/regions/districts/show'));
const DistrictEdit = lazy(() => import('@/pages/regions/districts/edit'));
const VillageCreate = lazy(() => import('@/pages/regions/villages/create'));
const VillageShow = lazy(() => import('@/pages/regions/villages/show'));
const VillageEdit = lazy(() => import('@/pages/regions/villages/edit'));

export function RegionRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      <Route path="/regions" element={<ProtectedRoute><RegionsIndex /></ProtectedRoute>} />
      <Route path="/regions/provinces/create" element={<ProtectedRoute><ProvinceCreate /></ProtectedRoute>} />
      <Route path="/regions/provinces/:id" element={<ProtectedRoute><ProvinceShow /></ProtectedRoute>} />
      <Route path="/regions/provinces/:id/edit" element={<ProtectedRoute><ProvinceEdit /></ProtectedRoute>} />
      <Route path="/regions/regencies/create" element={<ProtectedRoute><RegencyCreate /></ProtectedRoute>} />
      <Route path="/regions/regencies/:id" element={<ProtectedRoute><RegencyShow /></ProtectedRoute>} />
      <Route path="/regions/regencies/:id/edit" element={<ProtectedRoute><RegencyEdit /></ProtectedRoute>} />
      <Route path="/regions/districts/create" element={<ProtectedRoute><DistrictCreate /></ProtectedRoute>} />
      <Route path="/regions/districts/:id" element={<ProtectedRoute><DistrictShow /></ProtectedRoute>} />
      <Route path="/regions/districts/:id/edit" element={<ProtectedRoute><DistrictEdit /></ProtectedRoute>} />
      <Route path="/regions/villages/create" element={<ProtectedRoute><VillageCreate /></ProtectedRoute>} />
      <Route path="/regions/villages/:id" element={<ProtectedRoute><VillageShow /></ProtectedRoute>} />
      <Route path="/regions/villages/:id/edit" element={<ProtectedRoute><VillageEdit /></ProtectedRoute>} />
    </>
  );
}
