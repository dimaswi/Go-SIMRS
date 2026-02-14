import { Route } from 'react-router-dom';
import { lazy } from 'react';

// Master Menu Makanan
const NutritionMenusIndex = lazy(() => import('@/pages/nutrition/menus/index'));
const NutritionMenusCreate = lazy(() => import('@/pages/nutrition/menus/create'));
const NutritionMenusEdit = lazy(() => import('@/pages/nutrition/menus/edit'));
const NutritionMenusShow = lazy(() => import('@/pages/nutrition/menus/show'));

// Master Paket Makanan
const NutritionMealPackagesIndex = lazy(() => import('@/pages/nutrition/meal-packages/index'));
const NutritionMealPackagesCreate = lazy(() => import('@/pages/nutrition/meal-packages/create'));
const NutritionMealPackagesEdit = lazy(() => import('@/pages/nutrition/meal-packages/edit'));
const NutritionMealPackagesShow = lazy(() => import('@/pages/nutrition/meal-packages/show'));

// Dapur
const KitchenDashboard = lazy(() => import('@/pages/nutrition/kitchen/index'));

export function NutritionRoutes(ProtectedRoute: React.ComponentType<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Master Menu Makanan */}
      <Route path="/nutrition/menus" element={<ProtectedRoute><NutritionMenusIndex /></ProtectedRoute>} />
      <Route path="/nutrition/menus/create" element={<ProtectedRoute><NutritionMenusCreate /></ProtectedRoute>} />
      <Route path="/nutrition/menus/:id" element={<ProtectedRoute><NutritionMenusShow /></ProtectedRoute>} />
      <Route path="/nutrition/menus/:id/edit" element={<ProtectedRoute><NutritionMenusEdit /></ProtectedRoute>} />

      {/* Master Paket Makanan */}
      <Route path="/nutrition/meal-packages" element={<ProtectedRoute><NutritionMealPackagesIndex /></ProtectedRoute>} />
      <Route path="/nutrition/meal-packages/create" element={<ProtectedRoute><NutritionMealPackagesCreate /></ProtectedRoute>} />
      <Route path="/nutrition/meal-packages/:id" element={<ProtectedRoute><NutritionMealPackagesShow /></ProtectedRoute>} />
      <Route path="/nutrition/meal-packages/:id/edit" element={<ProtectedRoute><NutritionMealPackagesEdit /></ProtectedRoute>} />

      {/* Dapur */}
      <Route path="/nutrition/kitchen" element={<ProtectedRoute><KitchenDashboard /></ProtectedRoute>} />
    </>
  );
}
