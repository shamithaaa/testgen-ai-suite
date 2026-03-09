import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, TestTubes, AlertTriangle, Globe, XCircle, RotateCcw, Loader2, ServerCrash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGroupedTestCases } from "@/hooks/use-test-cases";
import { mockTestCases } from "@/lib/mockData";

const SECTION_META = [
  { key: "functional", label: "Functional Tests", icon: TestTubes },
  { key: "edge", label: "Edge Cases", icon: AlertTriangle },
  { key: "api", label: "API Validation", icon: Globe },
  { key: "failure", label: "Failure Scenarios", icon: XCircle },
  { key: "regression", label: "Regression Tests", icon: RotateCcw },
] as const;

const severityColors: Record<string, string> = {
  Critical: "bg-destructive/15 text-destructive border-destructive/20",
  High: "bg-warning/15 text-warning border-warning/20",
  Medium: "bg-primary/15 text-primary border-primary/20",
  Low: "bg-success/15 text-success border-success/20",
};

const GeneratedTests = () => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ functional: true });
  const requirementId = localStorage.getItem("lastRequirementId") ?? undefined;

  const { data, isLoading, isError } = useGroupedTestCases(requirementId);

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Fall back to mock data if backend is unreachable
  const grouped = data ?? (isError ? (mockTestCases as unknown as typeof data) : null);
  const total = grouped ? Object.values(grouped).flat().length : 0;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Loading generated test cases…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Generated Test Cases</h1>
            <p className="text-muted-foreground">
              {isError
                ? "Showing cached mock data — backend unreachable"
                : "AI-generated test suite based on your requirements"}
            </p>
          </div>
          <div className="floating-card px-4 py-2">
            <span className="text-2xl font-display font-bold text-primary">{total}</span>
            <span className="text-sm text-muted-foreground ml-2">tests generated</span>
          </div>
        </div>

        {isError && (
          <div className="floating-card p-4 mb-6 border-warning/30 flex items-center gap-3 text-sm text-warning">
            <ServerCrash className="h-4 w-4 shrink-0" />
            Could not reach backend. Showing mock data. Start the server with{" "}
            <code className="font-mono bg-muted px-1 rounded">uv run uvicorn main:app --reload --port 8000</code>
          </div>
        )}

        <div className="space-y-4">
          {SECTION_META.map((section, si) => {
            const items = grouped?.[section.key] ?? [];
            return (
              <motion.div
                key={section.key}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: si * 0.08 }}
                className="floating-card overflow-hidden"
              >
                <button
                  onClick={() => toggle(section.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <section.icon className="h-4 w-4 text-primary" />
                    <span className="font-display font-semibold text-sm">{section.label}</span>
                    <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
                      {items.length}
                    </Badge>
                  </div>
                  {expanded[section.key] ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                <AnimatePresence>
                  {expanded[section.key] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        {items.map((tc, i) => {
                          const tcId = "tc_id" in tc ? tc.tc_id : (tc as { id: string }).id;
                          return (
                            <motion.div
                              key={tcId}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="p-4 rounded-lg bg-muted/20 border border-border/30"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-xs text-muted-foreground">{tcId}</span>
                                  <span className="font-display font-medium text-sm">{tc.name}</span>
                                </div>
                                <Badge variant="outline" className={`text-xs ${severityColors[tc.severity]}`}>
                                  {tc.severity}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{tc.description}</p>
                              <div className="text-xs">
                                <span className="text-muted-foreground">Expected: </span>
                                <span className="text-foreground/80">{tc.expected}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default GeneratedTests;
