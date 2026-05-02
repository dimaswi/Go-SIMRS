import { Route, Routes } from 'react-router-dom';
import EKlaimDashboard from '@/pages/eklaim';
import ListSEP from '@/pages/eklaim-local/list-sep';
import SEPDetail from '@/pages/eklaim-local/sep-detail';
import EklaimList from '@/pages/eklaim-local/eklaim-list';
import EklaimDetail from '@/pages/eklaim-local/eklaim-detail';
import EklaimLogs from '@/pages/eklaim-local/logs';
import AllEklaimLogs from '@/pages/eklaim-local/all-logs';
import EklaimReport from '@/pages/eklaim-local/report';
import RMCasemixPage from '@/pages/eklaim-local/rm-casemix-page';

export default function EKlaimRoutes() {
  return (
    <Routes>
      {/* Dashboard */}
      <Route index element={<EKlaimDashboard />} />
      {/* E-Klaim Local Server */}
      <Route path="list-sep" element={<ListSEP />} />
      <Route path="list-sep/:sepId" element={<SEPDetail />} />
      <Route path="data-klaim" element={<EklaimList />} />
      <Route path="data-klaim/:id" element={<EklaimDetail />} />
      <Route path="data-klaim/:id/rekam-medis" element={<RMCasemixPage />} />
      <Route path="data-klaim/:id/cetakan" element={<EklaimDetail mode="cetakan" />} />
      <Route path="data-klaim/:id/logs" element={<EklaimLogs />} />
      <Route path="report" element={<EklaimReport />} />
      <Route path="log" element={<AllEklaimLogs />} />
    </Routes>
  );
}
