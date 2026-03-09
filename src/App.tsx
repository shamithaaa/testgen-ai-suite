import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Requirements from "./pages/Requirements";
import GeneratedTests from "./pages/GeneratedTests";
import SyntheticData from "./pages/SyntheticData";
import TestExecution from "./pages/TestExecution";
import Prioritization from "./pages/Prioritization";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/requirements" element={<Requirements />} />
              <Route path="/generated-tests" element={<GeneratedTests />} />
              <Route path="/synthetic-data" element={<SyntheticData />} />
              <Route path="/test-execution" element={<TestExecution />} />
              <Route path="/prioritization" element={<Prioritization />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
