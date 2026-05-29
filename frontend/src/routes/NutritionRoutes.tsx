import { Route } from 'react-router-dom';
import { lazy } from 'react';

// Master Menu Makanan
const NutritionMenusIndex = lazy(() => import('@/pages/nutrition/menus/index'));
const NutritionMenusCreate = lazy(() => import('@/pages/nutrition/menus/create'));
const NutritionMenusEdit = lazy(() => import('@/pages/nutrition/menus/edit'));
const NutritionMenusShow = lazy(() => import('@/pages/nutrition/menus/show'));

// Master Bahan Gizi
const NutritionIngredientsIndex = lazy(() => import('@/pages/nutrition/ingredients/index'));
const NutritionIngredientsCreate = lazy(() => import('@/pages/nutrition/ingredients/create'));
const NutritionIngredientsEdit = lazy(() => import('@/pages/nutrition/ingredients/edit'));
const NutritionIngredientsShow = lazy(() => import('@/pages/nutrition/ingredients/show'));

// Master Paket Makanan
const NutritionMealPackagesIndex = lazy(() => import('@/pages/nutrition/meal-packages/index'));
const NutritionMealPackagesCreate = lazy(() => import('@/pages/nutrition/meal-packages/create'));
const NutritionMealPackagesEdit = lazy(() => import('@/pages/nutrition/meal-packages/edit'));
const NutritionMealPackagesShow = lazy(() => import('@/pages/nutrition/meal-packages/show'));

// Faktur Bahan Gizi
const NutritionInvoicesIndex = lazy(() => import('@/pages/nutrition/invoices/index'));
const NutritionInvoicesCreate = lazy(() => import('@/pages/nutrition/invoices/create'));
const NutritionInvoicesEdit = lazy(() => import('@/pages/nutrition/invoices/edit'));
const NutritionInvoicesShow = lazy(() => import('@/pages/nutrition/invoices/show'));

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

      {/* Master Bahan Gizi */}
      <Route path="/nutrition/ingredients" element={<ProtectedRoute><NutritionIngredientsIndex /></ProtectedRoute>} />
      <Route path="/nutrition/ingredients/create" element={<ProtectedRoute><NutritionIngredientsCreate /></ProtectedRoute>} />
      <Route path="/nutrition/ingredients/:id" element={<ProtectedRoute><NutritionIngredientsShow /></ProtectedRoute>} />
      <Route path="/nutrition/ingredients/:id/edit" element={<ProtectedRoute><NutritionIngredientsEdit /></ProtectedRoute>} />

      {/* Master Paket Makanan */}
      <Route path="/nutrition/meal-packages" element={<ProtectedRoute><NutritionMealPackagesIndex /></ProtectedRoute>} />
      <Route path="/nutrition/meal-packages/create" element={<ProtectedRoute><NutritionMealPackagesCreate /></ProtectedRoute>} />
      <Route path="/nutrition/meal-packages/:id" element={<ProtectedRoute><NutritionMealPackagesShow /></ProtectedRoute>} />
      <Route path="/nutrition/meal-packages/:id/edit" element={<ProtectedRoute><NutritionMealPackagesEdit /></ProtectedRoute>} />

      {/* Faktur Bahan Gizi */}
      <Route path="/nutrition/invoices" element={<ProtectedRoute><NutritionInvoicesIndex /></ProtectedRoute>} />
      <Route path="/nutrition/invoices/create" element={<ProtectedRoute><NutritionInvoicesCreate /></ProtectedRoute>} />
      <Route path="/nutrition/invoices/:id" element={<ProtectedRoute><NutritionInvoicesShow /></ProtectedRoute>} />
      <Route path="/nutrition/invoices/:id/edit" element={<ProtectedRoute><NutritionInvoicesEdit /></ProtectedRoute>} />

      {/* Dapur */}
      <Route path="/nutrition/kitchen" element={<ProtectedRoute><KitchenDashboard /></ProtectedRoute>} />
    </>
  );
}
