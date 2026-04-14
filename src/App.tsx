import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Requirements from "./pages/Requirements";
import SyntheticData from "./pages/SyntheticData";
import TestExecution from "./pages/TestExecution";
import Prioritization from "./pages/Prioritization";
import LiveTestRunner from "./pages/LiveTestRunner";
import CodeReview from "./pages/CodeReview";
import CIIntelligence from "./pages/CIIntelligence";
import DefectPrediction from "./pages/DefectPrediction";
import GeneratedTests from "./pages/GeneratedTests";
import Incidents from "./pages/Incidents";
import Monitoring from "./pages/Monitoring";
import ReleaseGate from "./pages/ReleaseGate";
import RequirementsIntelligence from "./pages/RequirementsIntelligence";
import SprintIntelligence from "./pages/SprintIntelligence";
import Workspace from "./pages/Workspace";
import SDLCPipeline from "./pages/SDLCPipeline";
import NotFound from "./pages/NotFound";
import DashboardLayout from "@/components/DashboardLayout";
import UserProfile from "./pages/UserProfile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<DashboardLayout />}> {/* App shell with sidebar/header */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/requirements" element={<Requirements />} />
          <Route path="/synthetic-data" element={<SyntheticData />} />
          <Route path="/test-execution" element={<TestExecution />} />
          <Route path="/prioritization" element={<Prioritization />} />
          <Route path="/live-testing" element={<LiveTestRunner />} />
          <Route path="/live-test-runner" element={<LiveTestRunner />} />
          <Route path="/code-review" element={<CodeReview />} />
          <Route path="/ci-intelligence" element={<CIIntelligence />} />
          <Route path="/defect-prediction" element={<DefectPrediction />} />
          <Route path="/generated-tests" element={<GeneratedTests />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/release-gate" element={<ReleaseGate />} />
          <Route path="/requirements-intelligence" element={<RequirementsIntelligence />} />
          <Route path="/sprint-intelligence" element={<SprintIntelligence />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/pipeline" element={<SDLCPipeline />} />
          {/* New user profile route */}
          <Route path="/profile" element={<UserProfile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
