import { Route, Routes } from 'react-router-dom';
import VisitsIndex from '@/pages/visits';
import VisitShow from '@/pages/visits/show';
import BedsideView from '@/pages/visits/bedside';

export default function VisitRoutes() {
  return (
    <Routes>
      <Route index element={<VisitsIndex />} />
      <Route path=":id" element={<VisitShow />} />
      <Route path=":id/bedside" element={<BedsideView />} />
    </Routes>
  );
}
