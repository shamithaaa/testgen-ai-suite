import { motion } from "framer-motion";
import {
  TestTubes, CheckCircle2, XCircle, TrendingUp, AlertTriangle,
  Clock, Zap, BarChart3, Activity, Target, Layers, ArrowUpRight, ArrowDownRight,
  FileText, Play, ArrowUpDown, ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { mockTestResults, mockPrioritizedTests, mockTestCases, mockSyntheticData } from "@/lib/mockData";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart, RadialBar
} from "recharts";
import { useDashboardStats } from "@/hooks/use-dashboard";

const CATEGORY_COLORS: Record<string, string> = {
  functional: "hsl(174, 80%, 50%)",
  edge: "hsl(260, 60%, 55%)",
  api: "hsl(38, 90%, 55%)",
  failure: "hsl(0, 72%, 55%)",
  regression: "hsl(152, 60%, 45%)",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isError } = useDashboardStats();

  // Fall back to mock-derived values when backend is unreachable
  const mockPassed = mockTestResults.filter((t) => t.status === "PASS").length;
  const mockFailed = mockTestResults.filter((t) => t.status === "FAIL").length;
  const mockTotal = mockTestResults.length;
  const mockTotalTests = Object.values(mockTestCases).flat().length;

  const totalTests = stats?.total_tests ?? mockTotalTests;
  const passed = stats?.latest_run.passed ?? mockPassed;
  const failed = stats?.latest_run.failed ?? mockFailed;
  const successRate = stats?.latest_run.success_rate ?? Math.round((mockPassed / mockTotal) * 100);
  const avgDuration = (stats?.latest_run.avg_duration ?? (mockTestResults.reduce((s, t) => s + t.duration, 0) / mockTotal)).toFixed(1);
  const knownFailures = stats?.known_failures ?? mockPrioritizedTests.filter((t) => t.knownFailure).length;
  const highPriority = stats?.high_priority ?? mockPrioritizedTests.filter((t) => t.priority >= 80).length;
  const activeVehicles = stats?.active_vehicles ?? mockSyntheticData.filter((d) => d.status === "Active").length;

  // KPI cards
  const kpis = [
    { label: "Total Test Cases", value: totalTests, icon: TestTubes, change: "+12%", up: true, color: "text-primary" },
    { label: "Pass Rate", value: `${successRate}%`, icon: TrendingUp, change: "+3.2%", up: true, color: "text-success" },
    { label: "Failed Tests", value: failed, icon: XCircle, change: "-2", up: false, color: "text-destructive" },
    { label: "Avg Duration", value: `${avgDuration}s`, icon: Clock, change: "-0.4s", up: false, color: "text-warning" },
    { label: "Known Failures", value: knownFailures, icon: AlertTriangle, change: "0", up: false, color: "text-destructive" },
    { label: "High Priority", value: highPriority, icon: Target, change: "+1", up: true, color: "text-warning" },
  ];

  // Weekly trend — use real data or fall back to static mock
  const mockWeekly = [
    { day: "Mon", passed: 18, failed: 3, total: 21 },
    { day: "Tue", passed: 22, failed: 2, total: 24 },
    { day: "Wed", passed: 19, failed: 5, total: 24 },
    { day: "Thu", passed: 25, failed: 1, total: 26 },
    { day: "Fri", passed: 20, failed: 4, total: 24 },
    { day: "Sat", passed: 15, failed: 2, total: 17 },
    { day: "Sun", passed: mockPassed, failed: mockFailed, total: mockTotal },
  ];
  const weeklyTrend = stats?.weekly_trend?.length ? stats.weekly_trend : mockWeekly;

  // Category distribution — derived from real test_case_counts or mock
  const mockCounts = {
    functional: mockTestCases.functional.length,
    edge: mockTestCases.edge.length,
    api: mockTestCases.api.length,
    failure: mockTestCases.failure.length,
    regression: mockTestCases.regression.length,
  };
  const counts = stats?.test_case_counts ?? mockCounts;
  const categoryData = Object.entries(counts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    fill: CATEGORY_COLORS[name] ?? "hsl(260, 60%, 55%)",
  }));

  // Coverage data for radial chart
  const coverageData = [
    { name: "Functional", value: 85, fill: "hsl(174, 80%, 50%)" },
    { name: "Edge Cases", value: 60, fill: "hsl(260, 60%, 55%)" },
    { name: "API", value: 75, fill: "hsl(38, 90%, 55%)" },
    { name: "Regression", value: 50, fill: "hsl(152, 60%, 45%)" },
  ];

  // Severity breakdown
  const severityBreakdown = [
    { severity: "Critical", count: 5, color: "bg-destructive" },
    { severity: "High", count: 7, color: "bg-warning" },
    { severity: "Medium", count: 2, color: "bg-primary" },
    { severity: "Low", count: 1, color: "bg-success" },
  ];
  const totalSeverity = severityBreakdown.reduce((s, b) => s + b.count, 0);

  // Recent activity from mock (no dedicated endpoint yet)
  const recentActivity = mockTestResults.slice(0, 5).map((t) => ({
    ...t,
    timeAgo: `${Math.floor(Math.random() * 30) + 1}m ago`,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Dashboard</h1>
              <p className="text-muted-foreground text-sm">
                {isError
                  ? "Showing cached mock data — backend unreachable"
                  : "Live overview of your test intelligence platform"}
              </p>
            </div>
          </div>
        </div>

        {/* How It Works — beginner guide */}
        <div className="floating-card p-6 mb-8 border-primary/20">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold text-sm">How It Works — Follow These 4 Steps</h2>
            <Badge variant="secondary" className="ml-auto text-xs">Start here</Badge>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                step: 1, icon: FileText, color: "bg-primary/10 border-primary/20 text-primary",
                title: "Enter Requirement",
                desc: "Paste any software requirement in plain English. AI will read it and generate full test cases for you.",
                url: "/requirements", cta: "Go to Step 1",
              },
              {
                step: 2, icon: TestTubes, color: "bg-secondary/10 border-secondary/20 text-secondary",
                title: "Review Test Cases",
                desc: "See the generated tests grouped by type — functional, edge cases, API, failure, and regression.",
                url: "/generated-tests", cta: "Go to Step 2",
              },
              {
                step: 3, icon: Play, color: "bg-success/10 border-success/20 text-success",
                title: "Run the Tests",
                desc: "Execute all tests with one click. See which pass or fail with timing and result breakdown.",
                url: "/test-execution", cta: "Go to Step 3",
              },
              {
                step: 4, icon: ArrowUpDown, color: "bg-warning/10 border-warning/20 text-warning",
                title: "View Priority Ranking",
                desc: "AI ranks tests by risk and failure history so you fix the most critical issues first.",
                url: "/prioritization", cta: "Go to Step 4",
              },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex flex-col gap-3 p-4 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer group"
                onClick={() => navigate(s.url)}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg border flex items-center justify-center ${s.color}`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className={`text-xs font-bold font-mono ${s.color.split(" ").pop()}`}>Step {s.step}</span>
                </div>
                <div>
                  <p className="font-display font-semibold text-sm mb-1">{s.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
                <Button variant="ghost" size="sm" className="mt-auto self-start text-xs p-0 h-auto text-muted-foreground group-hover:text-foreground gap-1">
                  {s.cta} <ArrowRight className="h-3 w-3" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between mb-3">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <div className={`flex items-center gap-0.5 text-[10px] font-medium ${kpi.up ? "text-success" : kpi.change === "0" ? "text-muted-foreground" : "text-destructive"}`}>
                  {kpi.change !== "0" && (kpi.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
                  {kpi.change}
                </div>
              </div>
              <span className="text-2xl font-display font-bold block">{kpi.value}</span>
              <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {/* Weekly Trend */}
          <div className="lg:col-span-2 floating-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Weekly Test Trend
              </h3>
              <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">Last 7 days</Badge>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyTrend}>
                <defs>
                  <linearGradient id="passedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(152, 60%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0, 72%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }} />
                <Area type="monotone" dataKey="passed" stroke="hsl(152, 60%, 45%)" fill="url(#passedGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="failed" stroke="hsl(0, 72%, 55%)" fill="url(#failedGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Passed</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> Failed</span>
            </div>
          </div>

          {/* Test Category Distribution */}
          <div className="floating-card p-5">
            <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-secondary" /> Test Categories
            </h3>
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3} dataKey="value">
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
              {categoryData.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.fill }} />
                  <span className="text-muted-foreground truncate">{c.name}</span>
                  <span className="font-mono ml-auto">{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {/* Severity Breakdown */}
          <div className="floating-card p-5">
            <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Severity Breakdown
            </h3>
            <div className="space-y-3">
              {severityBreakdown.map((s) => (
                <div key={s.severity}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{s.severity}</span>
                    <span className="font-mono font-medium">{s.count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${s.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.count / totalSeverity) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border/30">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display font-bold">{totalSeverity} tests</span>
              </div>
            </div>
          </div>

          {/* Coverage Radial */}
          <div className="floating-card p-5">
            <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Test Coverage
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={coverageData} startAngle={180} endAngle={0}>
                <RadialBar dataKey="value" cornerRadius={4} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {coverageData.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.fill }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="font-mono ml-auto">{c.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats & Activity */}
          <div className="floating-card p-5">
            <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Recent Activity
            </h3>
            <div className="space-y-3">
              {recentActivity.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  {t.status === "PASS" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.id} · {t.duration}s</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{t.timeAgo}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row: Platform Metrics */}
        <div className="grid lg:grid-cols-4 gap-4">
          <div className="floating-card p-5 text-center">
            <Zap className="h-5 w-5 text-primary mx-auto mb-2" />
            <span className="text-3xl font-display font-bold text-gradient block">{totalTests}</span>
            <span className="text-xs text-muted-foreground">Tests Generated</span>
          </div>
          <div className="floating-card p-5 text-center">
            <Activity className="h-5 w-5 text-success mx-auto mb-2" />
            <span className="text-3xl font-display font-bold text-gradient block">{activeVehicles}</span>
            <span className="text-xs text-muted-foreground">Active Vehicles</span>
          </div>
          <div className="floating-card p-5 text-center">
            <BarChart3 className="h-5 w-5 text-secondary mx-auto mb-2" />
            <span className="text-3xl font-display font-bold text-gradient block">{stats ? Object.values(stats.test_case_counts).reduce((a, b) => a + b, 0) : mockSyntheticData.length}</span>
            <span className="text-xs text-muted-foreground">Data Records</span>
          </div>
          <div className="floating-card p-5 text-center">
            <Target className="h-5 w-5 text-warning mx-auto mb-2" />
            <span className="text-3xl font-display font-bold text-gradient block">{highPriority}</span>
            <span className="text-xs text-muted-foreground">Priority Alerts</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
