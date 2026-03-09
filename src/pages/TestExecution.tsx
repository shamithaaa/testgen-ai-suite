import { useState } from "react";
import { motion } from "framer-motion";
import { Play, CheckCircle2, XCircle, Clock, TrendingUp, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTestResults, useRunTests } from "@/hooks/use-test-execution";
import { mockTestResults } from "@/lib/mockData";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["hsl(152, 60%, 45%)", "hsl(0, 72%, 55%)"];

const TestExecution = () => {
  const [activeRunId, setActiveRunId] = useState<string | undefined>();
  const runTestsMutation = useRunTests();
  const { data: results, isLoading, isError } = useTestResults(activeRunId);

  // Fall back to mock when backend is unavailable
  const displayResults = results ?? (isError ? mockTestResults : []);
  const passed = displayResults.filter((t) => t.status === "PASS").length;
  const failed = displayResults.filter((t) => t.status === "FAIL").length;
  const total = displayResults.length;
  const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const totalDuration = displayResults.reduce((s, t) => s + t.duration, 0).toFixed(1);

  const pieData = [
    { name: "Passed", value: passed },
    { name: "Failed", value: failed },
  ];

  const stats = [
    { label: "Total Tests", value: total, icon: Play, color: "text-primary" },
    { label: "Passed", value: passed, icon: CheckCircle2, color: "text-success" },
    { label: "Failed", value: failed, icon: XCircle, color: "text-destructive" },
    { label: "Duration", value: `${totalDuration}s`, icon: Clock, color: "text-warning" },
  ];

  const handleRunTests = async () => {
    const summary = await runTestsMutation.mutateAsync(undefined);
    setActiveRunId(summary.run_id);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Test Execution Dashboard</h1>
            <p className="text-muted-foreground">
              {isError ? "Showing cached mock data â€” backend unreachable" : "Real-time test run monitoring and results"}
            </p>
          </div>
          <Button
            onClick={handleRunTests}
            disabled={runTestsMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-display glow-primary"
          >
            {runTestsMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Runningâ€¦</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" />Run Tests</>
            )}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="stat-card"
            >
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <span className="text-2xl font-display font-bold">{s.value}</span>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {/* Success rate */}
          <div className="floating-card p-5 flex flex-col items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary mb-2" />
            <span className="text-xs text-muted-foreground mb-1">Success Rate</span>
            <span className="text-4xl font-display font-bold text-gradient">{successRate}%</span>
            <div className="w-full mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-success to-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${successRate}%` }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          </div>

          {/* Pie chart */}
          <div className="floating-card p-5">
            <h3 className="font-display font-semibold text-sm mb-2 text-center">Pass vs Fail</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Passed</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> Failed</span>
            </div>
          </div>

          {/* Coverage */}
          <div className="floating-card p-5">
            <h3 className="font-display font-semibold text-sm mb-4">Test Coverage</h3>
            {[
              { label: "Functional", pct: 85 },
              { label: "Edge Cases", pct: 60 },
              { label: "API", pct: 75 },
              { label: "Regression", pct: 50 },
            ].map((c, i) => (
              <div key={c.label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-mono">{c.pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${c.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="floating-card overflow-hidden">
          <div className="p-4 border-b border-border/30 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-sm">Execution Timeline</span>
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-2" />}
            {activeRunId && (
              <span className="text-xs font-mono text-muted-foreground ml-auto">run: {activeRunId.slice(0, 8)}â€¦</span>
            )}
          </div>
          <div className="divide-y divide-border/20">
            {displayResults.map((t, i) => {
              const tcId = "tc_id" in t ? t.tc_id : (t as { id: string }).id;
              return (
                <motion.div
                  key={tcId + i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {t.status === "PASS" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="font-mono text-xs text-muted-foreground w-16">{tcId}</span>
                    <span className="text-sm">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground font-mono">{t.duration}s</span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${t.status === "PASS" ? "bg-success/15 text-success border-success/20" : "bg-destructive/15 text-destructive border-destructive/20"}`}
                    >
                      {t.status}
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TestExecution;
