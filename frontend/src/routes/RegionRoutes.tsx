import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute as PermissionGuard } from '@/components/protected-route';

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
      <Route path="/regions" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.view" redirectTo="/dashboard">
            <RegionsIndex />
          </PermissionGuard>
        </ProtectedRoute>
      } />

      <Route path="/regions/provinces/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.create" redirectTo="/regions">
            <ProvinceCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/regions/provinces/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.view" redirectTo="/regions">
            <ProvinceShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/regions/provinces/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.update" redirectTo="/regions">
            <ProvinceEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />

      <Route path="/regions/regencies/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.create" redirectTo="/regions">
            <RegencyCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/regions/regencies/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.view" redirectTo="/regions">
            <RegencyShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/regions/regencies/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.update" redirectTo="/regions">
            <RegencyEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />

      <Route path="/regions/districts/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.create" redirectTo="/regions">
            <DistrictCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/regions/districts/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.view" redirectTo="/regions">
            <DistrictShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/regions/districts/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.update" redirectTo="/regions">
            <DistrictEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />

      <Route path="/regions/villages/create" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.create" redirectTo="/regions">
            <VillageCreate />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/regions/villages/:id" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.view" redirectTo="/regions">
            <VillageShow />
          </PermissionGuard>
        </ProtectedRoute>
      } />
      <Route path="/regions/villages/:id/edit" element={
        <ProtectedRoute>
          <PermissionGuard permission="regions.update" redirectTo="/regions">
            <VillageEdit />
          </PermissionGuard>
        </ProtectedRoute>
      } />
    </>
  );
}
