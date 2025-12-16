import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

const ICDIndex = lazy(() => import('@/pages/icd/index'));
const ICDShow = lazy(() => import('@/pages/icd/show'));
const ICDCreate = lazy(() => import('@/pages/icd/create'));
const ICDEdit = lazy(() => import('@/pages/icd/edit'));

export function ICDRoutes() {
  return (
    <Routes>
      <Route index element={<ICDIndex />} />
      <Route path=":type/:code" element={<ICDShow />} />
      <Route path=":type/create" element={<ICDCreate />} />
      <Route path=":type/:id/edit" element={<ICDEdit />} />
    </Routes>
  );
}
