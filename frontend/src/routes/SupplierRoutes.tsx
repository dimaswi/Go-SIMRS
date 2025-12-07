import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/protected-route";

const SuppliersIndex = lazy(() => import("@/pages/suppliers/index"));
const SupplierCreate = lazy(() => import("@/pages/suppliers/create"));
const SupplierEdit = lazy(() => import("@/pages/suppliers/edit"));
const SupplierShow = lazy(() => import("@/pages/suppliers/show"));

export default function SupplierRoutes() {
  return (
    <Routes>
      <Route
        index
        element={
          <ProtectedRoute permission="suppliers.view">
            <SuppliersIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="create"
        element={
          <ProtectedRoute permission="suppliers.create">
            <SupplierCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path=":id/edit"
        element={
          <ProtectedRoute permission="suppliers.update">
            <SupplierEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path=":id"
        element={
          <ProtectedRoute permission="suppliers.view">
            <SupplierShow />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
