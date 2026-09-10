import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Each page is its own chunk, fetched on navigation rather than bundled into
// the initial load — the editor route in particular pulls in @xyflow/react
// and dagre, which are only needed once a user opens a pipeline.
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail').then(m => ({ default: m.VerifyEmail })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then(m => ({ default: m.ProjectDetail })));
const PipelineEditor = lazy(() => import('./pages/PipelineEditor').then(m => ({ default: m.PipelineEditor })));
const Connections = lazy(() => import('./pages/Connections').then(m => ({ default: m.Connections })));

function RouteFallback() {
  return <div className="min-h-screen bg-background flex items-center justify-center text-text-secondary">Loading...</div>;
}

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route element={<ProtectedRoute />}>
            {/* Routes with Sidebar Layout */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects/:projectId" element={<ProjectDetail />} />
              <Route path="/connections" element={<Connections />} />
            </Route>

            {/* Fullscreen Editor Route */}
            <Route path="/projects/:projectId/pipelines/:pipelineId" element={<PipelineEditor />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
