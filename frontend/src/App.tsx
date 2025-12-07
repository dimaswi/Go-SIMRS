import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute as PermissionGuard } from './components/protected-route';
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import { EmployeeRoutes, RegionRoutes, MasterDataRoutes, RoomRoutes, ProcedureRoutes, PatientRoutes, InventoryRoutes, MedicineRoutes, StockRequestRoutes, DistributionRoutes, PurchaseRoutes, StockOpnameRoutes, SupplierRoutes, RoomStockRoutes, QueueRoutes, RegistrationRoutes } from './routes';
import { KioskRoutes } from './routes/KioskRoutes';
import { QueueDisplayRoutes } from './routes/QueueDisplayRoutes';
import { CounterRoutes } from './routes/CounterRoutes';
import { RoomQueueRoutes } from './routes/RoomQueueRoutes';
import VisitRoutes from './routes/VisitRoutes';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/auth/login'));
const DashboardPage = lazy(() => import('./pages/dashboard/index'));
const AccountPage = lazy(() => import('./pages/account/index'));
const SettingsPage = lazy(() => import('./pages/settings/index'));

// Users
const UsersIndex = lazy(() => import('./pages/users/index'));
const UsersCreate = lazy(() => import('./pages/users/create'));
const UsersEdit = lazy(() => import('./pages/users/edit'));
const UsersShow = lazy(() => import('./pages/users/show'));

// Roles
const RolesIndex = lazy(() => import('./pages/roles/index'));
const RolesCreate = lazy(() => import('./pages/roles/create'));
const RolesEdit = lazy(() => import('./pages/roles/edit'));
const RolesShow = lazy(() => import('./pages/roles/show'));

// Permissions
const PermissionsIndex = lazy(() => import('./pages/permissions/index'));
const PermissionsCreate = lazy(() => import('./pages/permissions/create'));
const PermissionsEdit = lazy(() => import('./pages/permissions/edit'));
const PermissionsShow = lazy(() => import('./pages/permissions/show'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
}

function App() {
  // Load theme on app start
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Kiosk Route */}
          <Route path="/kiosk" element={<KioskRoutes />} />
          
          {/* Public Queue Display */}
          <Route path="/queue-display/*" element={<QueueDisplayRoutes />} />
          
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          
          {/* Users */}
          <Route path="/users" element={<ProtectedRoute><UsersIndex /></ProtectedRoute>} />
          <Route path="/users/create" element={
            <ProtectedRoute>
              <PermissionGuard permission="users.create">
                <UsersCreate />
              </PermissionGuard>
            </ProtectedRoute>
          } />
          <Route path="/users/:id" element={<ProtectedRoute><UsersShow /></ProtectedRoute>} />
          <Route path="/users/:id/edit" element={
            <ProtectedRoute>
              <PermissionGuard permission="users.update">
                <UsersEdit />
              </PermissionGuard>
            </ProtectedRoute>
          } />
          
          {/* Roles */}
          <Route path="/roles" element={<ProtectedRoute><RolesIndex /></ProtectedRoute>} />
          <Route path="/roles/create" element={
            <ProtectedRoute>
              <PermissionGuard permission="roles.create">
                <RolesCreate />
              </PermissionGuard>
            </ProtectedRoute>
          } />
          <Route path="/roles/:id" element={<ProtectedRoute><RolesShow /></ProtectedRoute>} />
          <Route path="/roles/:id/edit" element={
            <ProtectedRoute>
              <PermissionGuard permission="roles.update">
                <RolesEdit />
              </PermissionGuard>
            </ProtectedRoute>
          } />
          
          {/* Permissions */}
          <Route path="/permissions" element={<ProtectedRoute><PermissionsIndex /></ProtectedRoute>} />
          <Route path="/permissions/create" element={
            <ProtectedRoute>
              <PermissionGuard permission="permissions.create">
                <PermissionsCreate />
              </PermissionGuard>
            </ProtectedRoute>
          } />
          <Route path="/permissions/:id" element={<ProtectedRoute><PermissionsShow /></ProtectedRoute>} />
          <Route path="/permissions/:id/edit" element={
            <ProtectedRoute>
              <PermissionGuard permission="permissions.update">
                <PermissionsEdit />
              </PermissionGuard>
            </ProtectedRoute>
          } />
          
          {/* Employees */}
          {EmployeeRoutes(ProtectedRoute)}
          
          {/* Regions */}
          {RegionRoutes(ProtectedRoute)}
          
          {/* Master Data */}
          {MasterDataRoutes(ProtectedRoute)}
          
          {/* Counters */}
          <Route path="/counters/*" element={<ProtectedRoute><CounterRoutes /></ProtectedRoute>} />
          
          {/* Rooms */}
          {RoomRoutes(ProtectedRoute)}
          
          {/* Procedures */}
          {ProcedureRoutes(ProtectedRoute)}
          
          {/* Patients */}
          {PatientRoutes(ProtectedRoute)}
          
          {/* Inventories */}
          {InventoryRoutes(ProtectedRoute)}
          
          {/* Medicines */}
          {MedicineRoutes(ProtectedRoute)}
          
          {/* Stock Requests */}
          {StockRequestRoutes(ProtectedRoute)}
          
          {/* Distributions */}
          {DistributionRoutes(ProtectedRoute)}
          
          {/* Purchases */}
          {PurchaseRoutes(ProtectedRoute)}
          
          {/* Stock Opname */}
          {StockOpnameRoutes(ProtectedRoute)}
          
          {/* Suppliers */}
          <Route path="/suppliers/*" element={<ProtectedRoute><SupplierRoutes /></ProtectedRoute>} />
          
          {/* Queues */}
          {QueueRoutes(ProtectedRoute)}
          
          {/* Registrations */}
          {RegistrationRoutes(ProtectedRoute)}
          
          {/* Room Queues */}
          {RoomQueueRoutes(ProtectedRoute)}
          
          {/* Visits */}
          <Route path="/visits/*" element={<ProtectedRoute><VisitRoutes /></ProtectedRoute>} />
          
          {/* Room Stock */}
          {RoomStockRoutes(ProtectedRoute)}
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
