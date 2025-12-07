import { Route, Routes } from 'react-router-dom';
import VisitsIndex from '@/pages/visits';
import VisitShow from '@/pages/visits/show';

export default function VisitRoutes() {
  return (
    <Routes>
      <Route index element={<VisitsIndex />} />
      <Route path=":id" element={<VisitShow />} />
    </Routes>
  );
}
