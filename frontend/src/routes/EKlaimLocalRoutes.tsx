import { Route, Routes } from 'react-router-dom';
import ListSEP from '@/pages/eklaim-local/list-sep';
import SEPDetail from '@/pages/eklaim-local/sep-detail';
import EklaimList from '@/pages/eklaim-local/eklaim-list';
import EklaimDetail from '@/pages/eklaim-local/eklaim-detail';
import EklaimLogs from '@/pages/eklaim-local/logs';
import EklaimReport from '@/pages/eklaim-local/report';

export default function EKlaimLocalRoutes() {
  return (
    <Routes>
      <Route path="list-sep" element={<ListSEP />} />
      <Route path="list-sep/:sepId" element={<SEPDetail />} />
      <Route index element={<EklaimList />} />
      <Route path=":id" element={<EklaimDetail />} />
      <Route path=":id/logs" element={<EklaimLogs />} />
      <Route path="report" element={<EklaimReport />} />
    </Routes>
  );
}
