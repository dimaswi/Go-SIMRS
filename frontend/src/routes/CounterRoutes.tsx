import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import CounterIndex from '@/pages/counters';
import CounterCreate from '@/pages/counters/create';
import CounterEdit from '@/pages/counters/edit';
import CounterShow from '@/pages/counters/show';

export function CounterRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute permission="counters.view">
            <CounterIndex />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create"
        element={
          <ProtectedRoute permission="counters.create">
            <CounterCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:id"
        element={
          <ProtectedRoute permission="counters.view">
            <CounterShow />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:id/edit"
        element={
          <ProtectedRoute permission="counters.update">
            <CounterEdit />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

