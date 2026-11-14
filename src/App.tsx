import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryProvider } from "@/shared/context/QueryProvider";
import { ColorModeProvider } from "@/shared/context/ColorModeContext";
import { Topbar } from "@/layouts/Topbar";
import { DevTasksFab } from "@/features/tasks/components/DevTasksFab/DevTasksFab";
import { QueryDevtoolsGate } from "@/components/common/QueryDevtoolsGate";
import { MainLayout } from "@/layouts/MainLayout/MainLayout";
import { PageLoadingState } from "@/components/common/PageLoadingState";
import { QueryErrorBoundary } from "@/components/common/QueryErrorBoundary";

const GamePage = lazy(() => import("@/pages/GamePage").then((m) => ({ default: m.GamePage })));
const HarnessOverviewPage = lazy(() =>
  import("@/pages/HarnessOverviewPage").then((m) => ({ default: m.HarnessOverviewPage }))
);
const TasksPage = lazy(() =>
  import("@/pages/tasks/TasksPage").then((m) => ({ default: m.TasksPage }))
);

function AppContent() {
  const location = useLocation();
  const isTasksRoute = location.pathname === "/tasks";

  return (
    <>
      {!isTasksRoute && <Topbar />}
      <div className={isTasksRoute ? undefined : "pt-toolbar"}>
        <QueryErrorBoundary>
          <Suspense fallback={<PageLoadingState />}>
            <Routes>
              <Route path="/" element={<GamePage />} />
              <Route element={<MainLayout />}>
                <Route path="/harness" element={<HarnessOverviewPage />} />
              </Route>
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </QueryErrorBoundary>
      </div>
      <DevTasksFab />
      <QueryDevtoolsGate />
    </>
  );
}

function App() {
  return (
    <ColorModeProvider>
      <QueryProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </QueryProvider>
    </ColorModeProvider>
  );
}

export default App;
