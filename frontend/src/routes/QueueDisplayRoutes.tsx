import { Routes, Route, Navigate } from "react-router-dom";
import QueueDisplay from "@/pages/queue-display";
import CounterQueueDisplay from "@/pages/queue-display/counter";
import CashierQueueDisplay from "@/pages/queue-display/cashier";

export function QueueDisplayRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/settings/display" replace />} />
      <Route path="main" element={<QueueDisplay />} />
      <Route path="counter/:counterId" element={<CounterQueueDisplay />} />
      <Route path="cashier" element={<CashierQueueDisplay />} />
    </Routes>
  );
}
