import { Route, Routes } from 'react-router-dom';
import EKlaimIndex from '@/pages/eklaim';
import EKlaimShow from '@/pages/eklaim/show';
import EKlaimCreate from '@/pages/eklaim/create';

export default function EKlaimRoutes() {
  return (
    <Routes>
      <Route index element={<EKlaimIndex />} />
      <Route path="create" element={<EKlaimCreate />} />
      <Route path=":id" element={<EKlaimShow />} />
    </Routes>
  );
}
