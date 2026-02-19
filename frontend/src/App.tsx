import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute as PermissionGuard } from './components/protected-route';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { NotificationProvider } from '@/contexts/notification-context';
import { Loader2 } from 'lucide-react';
import { EmployeeRoutes, RegionRoutes, MasterDataRoutes, RoomRoutes, ProcedureRoutes, PatientRoutes, InventoryRoutes, MedicineRoutes, StockRequestRoutes, DistributionRoutes, PurchaseRoutes, StockOpnameRoutes, SupplierRoutes, RoomStockRoutes, QueueRoutes, RegistrationRoutes, IntegrationsRoutes, NutritionRoutes } from './routes';
import { KioskRoutes } from './routes/KioskRoutes';
import { QueueDisplayRoutes } from './routes/QueueDisplayRoutes';
import { CounterRoutes } from './routes/CounterRoutes';
import { RoomQueueRoutes } from './routes/RoomQueueRoutes';
import VisitRoutes from './routes/VisitRoutes';
import BillingRoutes from './routes/BillingRoutes';
import { ICDRoutes } from './routes/ICDRoutes';
import EKlaimRoutes from './routes/EKlaimRoutes';
import ReportRoutes from './routes/ReportRoutes';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/auth/login'));
const DashboardPage = lazy(() => import('./pages/dashboard/index'));
const AccountPage = lazy(() => import('./pages/account/index'));
const SettingsPage = lazy(() => import('./pages/settings/index'));
const SignaturePINSetupPage = lazy(() => import('./pages/account/signature-pin'));
const AuditLogPage = lazy(() => import('./pages/settings/audit-log'));

// Public Bed Monitoring
const PublicBedMonitoring = lazy(() => import('./pages/rooms/public-monitoring'));

// Public Signature Verification
const VerifySignaturePage = lazy(() => import('./pages/verify/index'));

// Bed Monitoring (Protected)
const BedMonitoringIndex = lazy(() => import('./pages/bed-monitoring/index'));
const BedMonitoringShow = lazy(() => import('./pages/rooms/monitoring'));

// Floor Plan
const FloorPlanPage = lazy(() => import('./pages/floor-plan/index'));

// Buildings
const BuildingsPage = lazy(() => import('./pages/buildings/index'));

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

// Patient Search (from header)
const PatientSearchIndex = lazy(() => import('./pages/patient-search/index'));
const PatientSearchShow = lazy(() => import('./pages/patient-search/show'));

// Admission Requests
const AdmissionRequestsIndex = lazy(() => import('./pages/admisi/index'));
const AdmissionRequestsShow = lazy(() => import('./pages/admisi/show'));

// Check-in Scanner
const CheckInScannerPage = lazy(() => import('./pages/checkin/scanner'));

// Patient Portal (Public)
const PatientPortalLogin = lazy(() => import('./pages/patient-portal/login'));
const PatientPortalDashboard = lazy(() => import('./pages/patient-portal/dashboard'));

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
    <NotificationProvider>
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public Kiosk Route */}
          <Route path="/kiosk" element={<KioskRoutes />} />
          
          {/* Public Queue Display */}
          <Route path="/queue-display/*" element={<QueueDisplayRoutes />} />
          
          {/* Public Bed Monitoring Display (for TV/public display) */}
          <Route path="/display/bed-monitoring/:id" element={<PublicBedMonitoring />} />
          
          {/* Public Signature Verification */}
          <Route path="/verify/:hash" element={<VerifySignaturePage />} />
          
          {/* Patient Portal (Public with patient authentication) */}
          <Route path="/portal" element={<PatientPortalLogin />} />
          <Route path="/portal/dashboard" element={<PatientPortalDashboard />} />
          
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/account/signature-pin" element={<ProtectedRoute><SignaturePINSetupPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/audit-log" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
          
          {/* Bed Monitoring (Protected) */}
          <Route path="/bed-monitoring" element={<ProtectedRoute><BedMonitoringIndex /></ProtectedRoute>} />
          <Route path="/bed-monitoring/:id" element={<ProtectedRoute><BedMonitoringShow /></ProtectedRoute>} />
          
          {/* Floor Plan */}
          <Route path="/floor-plan" element={<ProtectedRoute><FloorPlanPage /></ProtectedRoute>} />
          
          {/* Buildings */}
          <Route path="/buildings" element={<ProtectedRoute><BuildingsPage /></ProtectedRoute>} />
          
          {/* Check-in Scanner */}
          <Route path="/checkin" element={<ProtectedRoute><CheckInScannerPage /></ProtectedRoute>} />
          
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
          
          {/* Patient Search (from header) */}
          <Route path="/patient-search" element={<ProtectedRoute><PatientSearchIndex /></ProtectedRoute>} />
          <Route path="/patient-search/:id" element={<ProtectedRoute><PatientSearchShow /></ProtectedRoute>} />
          
          {/* Admission Requests */}
          <Route path="/admisi" element={
            <ProtectedRoute>
              <PermissionGuard permission="registrations.view">
                <AdmissionRequestsIndex />
              </PermissionGuard>
            </ProtectedRoute>
          } />
          <Route path="/admisi/:id" element={
            <ProtectedRoute>
              <PermissionGuard permission="registrations.view">
                <AdmissionRequestsShow />
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
          
          {/* Billing & Kasir */}
          <Route path="/billing/*" element={<ProtectedRoute><BillingRoutes /></ProtectedRoute>} />
          
          {/* E-Klaim */}
          <Route path="/eklaim/*" element={<ProtectedRoute><EKlaimRoutes /></ProtectedRoute>} />
          
          {/* Room Stock */}
          {RoomStockRoutes(ProtectedRoute)}
          
          {/* ICD Codes */}
          <Route path="/icd/*" element={<ProtectedRoute><ICDRoutes /></ProtectedRoute>} />
          
          {/* BPJS */}
          {IntegrationsRoutes(ProtectedRoute)}

          {/* Nutrition / Gizi */}
          {NutritionRoutes(ProtectedRoute)}

          {/* Reports / Laporan */}
          <Route path="/reports/*" element={<ProtectedRoute><ReportRoutes /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
      <SonnerToaster position="top-right" richColors />
    </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
