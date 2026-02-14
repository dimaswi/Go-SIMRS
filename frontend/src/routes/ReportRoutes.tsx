import { Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const ReportIndex = lazy(() => import('@/pages/reports/index'));
const ReportVisits = lazy(() => import('@/pages/reports/index').then(m => ({ default: m.ReportVisitsPage })));
const ReportBPJS = lazy(() => import('@/pages/reports/index').then(m => ({ default: m.ReportBPJSPage })));
const ReportBilling = lazy(() => import('@/pages/reports/index').then(m => ({ default: m.ReportBillingPage })));
const ReportInpatient = lazy(() => import('@/pages/reports/index').then(m => ({ default: m.ReportInpatientPage })));
const ReportPharmacy = lazy(() => import('@/pages/reports/index').then(m => ({ default: m.ReportPharmacyPage })));
const ReportPenunjang = lazy(() => import('@/pages/reports/index').then(m => ({ default: m.ReportPenunjangPage })));
const ReportInventory = lazy(() => import('@/pages/reports/index').then(m => ({ default: m.ReportInventoryPage })));
const ReportHR = lazy(() => import('@/pages/reports/index').then(m => ({ default: m.ReportHRPage })));
const ReportKemenkes = lazy(() => import('@/pages/reports/index').then(m => ({ default: m.ReportKemenkesPage })));

function Loading() {
  return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></div>;
}

export default function ReportRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<ReportIndex />} />
        <Route path="visits" element={<ReportVisits />} />
        <Route path="bpjs" element={<ReportBPJS />} />
        <Route path="billing" element={<ReportBilling />} />
        <Route path="inpatient" element={<ReportInpatient />} />
        <Route path="pharmacy" element={<ReportPharmacy />} />
        <Route path="penunjang" element={<ReportPenunjang />} />
        <Route path="inventory" element={<ReportInventory />} />
        <Route path="hr" element={<ReportHR />} />
        <Route path="kemenkes" element={<ReportKemenkes />} />
      </Routes>
    </Suspense>
  );
}
