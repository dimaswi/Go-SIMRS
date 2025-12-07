import { Routes, Route } from "react-router-dom";
import QueueDisplayNavigation from "@/pages/queue-display/navigation";
import QueueDisplay from "@/pages/queue-display";
import CounterQueueDisplay from "@/pages/queue-display/counter";

export function QueueDisplayRoutes() {
  return (
    <Routes>
      <Route index element={<QueueDisplayNavigation />} />
      <Route path="main" element={<QueueDisplay />} />
      <Route path="counter/:counterId" element={<CounterQueueDisplay />} />
    </Routes>
  );
}
