import { Route, Routes } from 'react-router-dom';
import BillingIndex from '@/pages/billing';
import BillingShow from '@/pages/billing/show';
import BillingPayment from '@/pages/billing/payment';

export default function BillingRoutes() {
  return (
    <Routes>
      <Route index element={<BillingIndex />} />
      <Route path=":id" element={<BillingShow />} />
      <Route path=":id/payment" element={<BillingPayment />} />
    </Routes>
  );
}
