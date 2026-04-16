import { useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Github,
  Globe,
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Camera,
  RotateCcw,
  Layers,
  Workflow,
  Code2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  GripVertical,
  ListChecks,
  Shield,
  Navigation,
  MousePointer,
  Zap,
  Bug,
  GitCommit,
  GitBranch,
  Eye,
  Terminal,
  ExternalLink,
  Hash,
  Download,
  Upload,
  FileCode,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLiveTesting, useFetchCommits, useRunHistory, LiveTestingPhase } from "../hooks/use-live-testing";
import { PlaywrightTestCase, TestStep, LiveTestResult, StepResult, CommitInfo, RunSummaryItem, RepoAnalysisResult } from "../lib/api";
import { downloadLiveTestReport, downloadRunSummaryReport } from "../lib/pdf-report";

// ── Severity badge colours ────────────────────────────────────────────────────

const severityClass: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-400 border-red-500/30",
  High: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

// ── Step action icon / colour ─────────────────────────────────────────────────

function stepActionLabel(action: string) {
  const map: Record<string, { label: string; color: string }> = {
    navigate: { label: "Navigate", color: "text-blue-400" },
    click: { label: "Click", color: "text-green-400" },
    fill: { label: "Fill", color: "text-purple-400" },
    assert_text: { label: "Assert", color: "text-yellow-400" },
    screenshot: { label: "Screenshot", color: "text-cyan-400" },
    wait: { label: "Wait", color: "text-gray-400" },
    hover: { label: "Hover", color: "text-pink-400" },
    hover_and_click: { label: "Hover+Click", color: "text-orange-400" },
    press: { label: "Press", color: "text-indigo-400" },
    check: { label: "Check", color: "text-teal-400" },
    uncheck: { label: "Uncheck", color: "text-teal-400" },
    select_option: { label: "Select", color: "text-violet-400" },
    drag_and_drop: { label: "Drag", color: "text-rose-400" },
    dblclick: { label: "DblClick", color: "text-emerald-400" },
    type_into: { label: "Type", color: "text-purple-300" },
    scroll: { label: "Scroll", color: "text-slate-400" },
    clear: { label: "Clear", color: "text-gray-400" },
  };
  return map[action] ?? { label: action, color: "text-muted-foreground" };
}

// ── All supported step actions ────────────────────────────────────────────────
const STEP_ACTIONS = [
  "navigate", "click", "fill", "assert_text", "screenshot", "wait",
  "hover", "hover_and_click", "press", "check", "uncheck",
  "select_option", "drag_and_drop", "dblclick", "type_into", "scroll", "clear",
] as const;

// ── Screenshot Viewer ─────────────────────────────────────────────────────────

function ScreenshotViewer({
  steps,
}: {
  steps: StepResult[];
}) {
  const withShots = steps.filter((s) => s.screenshot);
  const [idx, setIdx] = useState(0);

  if (withShots.length === 0) return null;

  const current = withShots[Math.min(idx, withShots.length - 1)];

  return (
    <div className="mt-3 rounded-lg border border-border/50 bg-black/30 overflow-hidden">
      {/* Screenshot */}
      <div className="relative bg-black">
        <img
          src={`data:image/png;base64,${current.screenshot}`}
          alt={current.step_description}
          className="w-full object-contain max-h-64"
        />
        {current.status === "fail" && (
          <div className="absolute top-2 right-2 bg-red-500/80 text-white text-[10px] px-2 py-0.5 rounded">
            FAILED STEP
          </div>
        )}
      </div>

      {/* Step nav */}
      <div className="flex items-center gap-1.5 p-2 overflow-x-auto">
        {withShots.map((s, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded border transition-colors ${
              i === idx
                ? "bg-primary/20 border-primary/50 text-primary"
                : s.status === "fail"
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-muted border-border/50 text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Step {i + 1}
          </button>
        ))}
      </div>
      <p className="px-3 pb-2 text-[11px] text-muted-foreground">{current.step_description}</p>
    </div>
  );
}

// ── Live test result card ─────────────────────────────────────────────────────

function LiveTestCard({ result }: { result: LiveTestResult }) {
  const [open, setOpen] = useState(false);

  const statusIcon = {
    running: <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />,
    passed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
    failed: <XCircle className="h-4 w-4 text-red-400" />,
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  }[result.status];

  const progress =
    result.total_steps > 0
      ? Math.round((result.steps_completed / result.total_steps) * 100)
      : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border/50 bg-card/50 overflow-hidden"
    >
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {statusIcon}
        <span className="flex-1 text-sm font-medium truncate">{result.test_name}</span>
        {result.duration_ms && (
          <span className="text-[11px] text-muted-foreground mr-2">
            {(result.duration_ms / 1000).toFixed(1)}s
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {result.steps_completed}/{result.total_steps} steps
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-1" />
        )}
      </button>

      {/* Progress bar (while running) */}
      {result.status === "running" && (
        <Progress value={progress} className="h-0.5 rounded-none" />
      )}

      {/* Expanded content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5">
              {/* Error banner */}
              {result.error && (
                <div className="flex items-start gap-2 rounded bg-red-500/10 border border-red-500/20 p-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-400">{result.error}</p>
                </div>
              )}

              {/* Step list */}
              {result.step_results.map((sr, i) => {
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-xs rounded p-1.5 ${
                      sr.status === "fail"
                        ? "bg-red-500/10 border border-red-500/20"
                        : "bg-muted/30"
                    }`}
                  >
                    {sr.status === "pass" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="text-muted-foreground flex-1">{sr.step_description}</span>
                    {sr.screenshot && (
                      <Camera className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                    )}
                  </div>
                );
              })}

              {/* Screenshot gallery */}
              <ScreenshotViewer steps={result.step_results} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Generated test case preview ───────────────────────────────────────────────

function TestCasePreview({ test }: { test: PlaywrightTestCase }) {
  const [open, setOpen] = useState(false);
  const sev = test.severity || "Medium";

  return (
    <div className="rounded-lg border border-border/50 bg-card/40 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{test.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{test.page_name}</p>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] ${severityClass[sev] ?? ""} flex-shrink-0`}
        >
          {sev}
        </Badge>
        <span className="text-[11px] text-muted-foreground ml-1">{test.steps.length} steps</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1">
              <p className="text-xs text-muted-foreground mb-2">{test.description}</p>
              {test.steps.map((step, i) => {
                const { label, color } = stepActionLabel(step.action);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-16 text-right font-mono text-[10px] ${color}`}>
                      {label}
                    </span>
                    <ArrowRight className="h-3 w-3 text-border flex-shrink-0" />
                    <span className="text-muted-foreground truncate">{step.description}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Test Case Editor ──────────────────────────────────────────────────────────

const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;

function TestCaseEditor({
  test,
  onSave,
}: {
  test: PlaywrightTestCase;
  onSave: (id: string, updates: Partial<PlaywrightTestCase>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PlaywrightTestCase>(test);
  const sev = test.severity || "Medium";

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft({ ...test });
    setEditing(true);
    setOpen(true);
  };

  const cancelEdit = () => {
    setDraft({ ...test });
    setEditing(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await onSave(test.id, {
        name: draft.name,
        description: draft.description,
        severity: draft.severity,
        steps: draft.steps,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const updateStep = (idx: number, field: keyof TestStep, val: string) => {
    setDraft((prev) => {
      const steps = [...prev.steps];
      steps[idx] = { ...steps[idx], [field]: val || null } as TestStep;
      return { ...prev, steps };
    });
  };

  const addStep = () => {
    setDraft((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { action: "screenshot", selector: null, value: null, description: "New step" } as TestStep,
      ],
    }));
  };

  const removeStep = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx),
    }));
  };

  const displayTest = editing ? draft : test;

  return (
    <div className="rounded-lg border border-border/50 bg-card/40 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/20 transition-colors"
        onClick={() => !editing && setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              value={draft.name}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              className="h-7 text-sm font-medium"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-sm font-medium truncate">{displayTest.name}</p>
          )}
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{displayTest.page_name}</p>
        </div>
        {editing ? (
          <select
            value={draft.severity}
            onChange={(e) => setDraft((p) => ({ ...p, severity: e.target.value }))}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] rounded border border-border/50 bg-background px-1.5 py-0.5 flex-shrink-0"
          >
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <Badge
            variant="outline"
            className={`text-[10px] ${severityClass[sev] ?? ""} flex-shrink-0`}
          >
            {sev}
          </Badge>
        )}
        <span className="text-[11px] text-muted-foreground">{displayTest.steps.length} steps</span>
        {!editing && (
          <button
            onClick={startEdit}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title="Edit test case"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {!editing && (open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />)}
      </button>

      <AnimatePresence>
        {(open || editing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {/* Description */}
              {editing ? (
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  className="text-xs min-h-[60px]"
                  placeholder="Test description..."
                />
              ) : (
                <p className="text-xs text-muted-foreground">{displayTest.description}</p>
              )}

              {/* Steps */}
              <div className="space-y-1">
                {(editing ? draft.steps : displayTest.steps).map((step, i) => {
                  const { label, color } = stepActionLabel(step.action);
                  return editing ? (
                    <div key={i} className="rounded bg-muted/20 border border-border/30 p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-[10px] text-muted-foreground font-mono w-5">{i + 1}.</span>
                        <select
                          value={step.action}
                          onChange={(e) => updateStep(i, "action", e.target.value)}
                          className="text-[10px] rounded border border-border/50 bg-background px-1.5 py-0.5 flex-1"
                        >
                          {STEP_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <button
                          onClick={() => removeStep(i)}
                          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 flex-shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <Input
                        value={step.description}
                        onChange={(e) => updateStep(i, "description", e.target.value)}
                        placeholder="Step description"
                        className="h-6 text-[11px]"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input
                          value={step.selector ?? ""}
                          onChange={(e) => updateStep(i, "selector", e.target.value)}
                          placeholder='selector (e.g. button:has-text("OK"))'
                          className="h-6 text-[10px] font-mono"
                        />
                        <Input
                          value={step.value ?? ""}
                          onChange={(e) => updateStep(i, "value", e.target.value)}
                          placeholder="value"
                          className="h-6 text-[10px] font-mono"
                        />
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`w-20 text-right font-mono text-[10px] ${color}`}>{label}</span>
                      <ArrowRight className="h-3 w-3 text-border flex-shrink-0" />
                      <span className="text-muted-foreground truncate">{step.description}</span>
                    </div>
                  );
                })}

                {editing && (
                  <button
                    onClick={addStep}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-dashed border-border/50 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Add Step
                  </button>
                )}
              </div>

              {/* Edit actions */}
              {editing && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Test Case Type options ────────────────────────────────────────────────────

const TEST_CASE_TYPES = [
  {
    value: "e2e",
    label: "E2E / Functional",
    desc: "Full user journey tests, happy paths, complete workflows",
    prompt: "Generate comprehensive end-to-end functional tests covering complete user workflows from start to finish. Include happy paths and critical user flows.",
  },
  {
    value: "smoke",
    label: "Smoke / Sanity",
    desc: "Quick checks on the most critical app paths",
    prompt: "Generate smoke tests that verify the most critical functionality works. Focus on core features that must work for the app to be usable.",
  },
  {
    value: "regression",
    label: "Regression",
    desc: "Comprehensive suite covering all features and edge cases",
    prompt: "Generate a comprehensive regression test suite covering all major features, user flows, edge cases, and boundary conditions.",
  },
  {
    value: "security",
    label: "Security",
    desc: "Auth flows, input validation, access control tests",
    prompt: "Generate security-focused tests covering authentication, authorization, input validation, and access control. Test for common security vulnerabilities.",
  },
  {
    value: "accessibility",
    label: "Accessibility",
    desc: "WCAG compliance, keyboard nav, ARIA attributes",
    prompt: "Generate accessibility tests that verify WCAG compliance, keyboard navigation, focus management, and proper ARIA attributes.",
  },
  {
    value: "api",
    label: "API / Integration",
    desc: "API calls, data flows, error handling",
    prompt: "Generate integration tests verifying correct API interactions, data flow between components, and proper handling of API responses and errors.",
  },
];

// ── Quick test type chips ─────────────────────────────────────────────────────

const TEST_TYPE_CHIPS = [
  { label: "Auth Flows", icon: Shield, desc: "Login, logout, session, protected routes" },
  { label: "CRUD", icon: ListChecks, desc: "Create, read, update, delete operations" },
  { label: "Navigation", icon: Navigation, desc: "Page routing, links, redirects" },
  { label: "Form Validation", icon: MousePointer, desc: "Input validation, error messages" },
  { label: "Edge Cases", icon: Zap, desc: "Boundary values, empty states, limits" },
  { label: "Error Handling", icon: Bug, desc: "Error pages, failure states, 404s" },
];

// ── Upload Spec Panel ─────────────────────────────────────────────────────────

function UploadSpecPanel({
  onUpload,
  isParsing,
  errorMsg,
  initialAppUrl,
}: {
  onUpload: (file: File, targetUrl: string, email?: string, password?: string) => void;
  isParsing: boolean;
  errorMsg: string | null;
  initialAppUrl?: string;
}) {
  const [targetUrl, setTargetUrl] = useState(initialAppUrl ?? "https://simple-tasks-zeta.vercel.app/");
  const [testEmail, setTestEmail] = useState("balaji0707srp@gmail.com");
  const [testPassword, setTestPassword] = useState("1234567890");
  const [showPassword, setShowPassword] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isLocalhost = targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1");
  const canRun = selectedFile && targetUrl.trim().startsWith("http") && !isParsing;

  const handleFile = (f: File) => {
    if (f.name.endsWith(".ts") || f.name.endsWith(".js")) {
      setSelectedFile(f);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-5">
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-0">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Upload Spec File</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Upload an existing <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">.spec.ts</code> file. Tests will be parsed and run directly — no AI generation needed.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{errorMsg}</p>
            </div>
          )}

          {/* Drop zone */}
          <div
            className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : selectedFile
                ? "border-green-500/50 bg-green-500/5"
                : "border-border/50 hover:border-primary/40 hover:bg-muted/20"
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".ts,.js,.spec.ts,.spec.js"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
              {selectedFile ? (
                <>
                  <div className="h-12 w-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <FileCode className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-400">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB — click to change</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Drop your spec file here</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      or click to browse — <code className="font-mono">.spec.ts</code> / <code className="font-mono">.spec.js</code>
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Target URL */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Target App URL
            </label>
            <Input
              placeholder="https://your-app.vercel.app"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={isParsing}
              className="h-10"
            />
            {isLocalhost && targetUrl.trim().length > 10 ? (
              <div className="flex items-start gap-1.5 rounded bg-yellow-500/10 border border-yellow-500/20 px-2 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-300 leading-snug">
                  Playwright runs <strong>inside the backend</strong>. Your app must be accessible from this machine.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">The app must be running and accessible from this server.</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border/50 bg-card/30 p-3">
            <p className="text-xs font-medium text-foreground/90">Test Credentials (if login is required)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                type="email"
                placeholder="qa-user@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                disabled={isParsing}
                className="h-10"
              />
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  disabled={isParsing}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Credentials are inserted into matching username/email/password fill steps before execution.
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!canRun}
            onClick={() => selectedFile && onUpload(selectedFile, targetUrl.trim(), testEmail || undefined, testPassword || undefined)}
          >
            {isParsing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Parsing spec file…</>
            ) : (
              <><FlaskConical className="h-4 w-4 mr-2" />Parse &amp; Preview Tests</>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Phase: Input form ─────────────────────────────────────────────────────────

function InputPhase({
  onAnalyze,
  onUploadSpec,
  isAnalyzing,
  isParsing,
  errorMsg,
  initialGithubUrl,
  initialAppUrl,
}: {
  onAnalyze: (
    github: string, target: string, email?: string, password?: string, preferences?: string,
    numTests?: number, mode?: "full" | "commit", commitSha?: string, commitMessage?: string,
  ) => void;
  onUploadSpec: (file: File, targetUrl: string, email?: string, password?: string) => void;
  isAnalyzing: boolean;
  isParsing: boolean;
  errorMsg: string | null;
  initialGithubUrl?: string;
  initialAppUrl?: string;
}) {
  const [inputMode, setInputMode] = useState<"ai" | "upload">("ai");
  const [githubUrl, setGithubUrl] = useState(initialGithubUrl ?? "https://github.com/balaji-joulestowatts/simple-tasks");
  const [targetUrl, setTargetUrl] = useState(initialAppUrl ?? "https://simple-tasks-zeta.vercel.app/");
  const [testEmail, setTestEmail] = useState("balaji0707srp@gmail.com");
  const [testPassword, setTestPassword] = useState("1234567890");
  const [showPassword, setShowPassword] = useState(false);
  const [testPreferences, setTestPreferences] = useState("");
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [testCaseType, setTestCaseType] = useState("e2e");
  const [numTests, setNumTests] = useState(1);

  // ── Commit-mode state ────────────────────────────────────────────────────
  const [testingScope, setTestingScope] = useState<"full" | "commit">("full");
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const fetchCommits = useFetchCommits();
  const commits: CommitInfo[] = (fetchCommits.data?.commits ?? []) as CommitInfo[];
  const isFetchingCommits = fetchCommits.isPending;

  const handleFetchCommits = () => {
    if (githubUrl.trim().startsWith("https://")) {
      setSelectedCommit(null);
      fetchCommits.mutate(githubUrl.trim());
    }
  };

  const toggleChip = (label: string) => {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      // Build preferences from chips
      const chipTexts = Array.from(next).map((l) => {
        const chip = TEST_TYPE_CHIPS.find((c) => c.label === l);
        return chip ? `${l}: ${chip.desc}` : l;
      });
      // Merge with any freetext
      const freeText = testPreferences.replace(/^(Auth Flows|CRUD|Navigation|Form Validation|Edge Cases|Error Handling).*\n?/gm, "").trim();
      setTestPreferences([...chipTexts, ...(freeText ? [freeText] : [])].join("\n"));
      return next;
    });
  };

  const isLocalhost = targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1");
  const canSubmit =
    githubUrl.trim().startsWith("https://") &&
    targetUrl.trim().startsWith("http") &&
    (testingScope === "full" || selectedCommit !== null);

  // Upload mode — render separate panel
  if (inputMode === "upload") {
    return (
      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="max-w-6xl mx-auto flex justify-center">
          <div className="flex rounded-lg border border-border/50 bg-background/50 p-0.5 gap-0.5">
            <button
              onClick={() => setInputMode("ai")}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Play className="h-3 w-3" /> AI Generation
            </button>
            <button
              onClick={() => setInputMode("upload")}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium bg-primary text-primary-foreground shadow-sm transition-colors"
            >
              <Upload className="h-3 w-3" /> Upload Spec File
            </button>
          </div>
        </div>
        <UploadSpecPanel
          onUpload={onUploadSpec}
          isParsing={isParsing}
          errorMsg={errorMsg}
          initialAppUrl={initialAppUrl}
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto"
    >
      {/* Mode toggle */}
      <div className="flex justify-center mb-4">
        <div className="flex rounded-lg border border-border/50 bg-background/50 p-0.5 gap-0.5">
          <button
            onClick={() => setInputMode("ai")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium bg-primary text-primary-foreground shadow-sm transition-colors"
          >
            <Play className="h-3 w-3" /> AI Generation
          </button>
          <button
            onClick={() => setInputMode("upload")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <Upload className="h-3 w-3" /> Upload Spec File
          </button>
        </div>
      </div>

      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-0">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl">Live Test Runner</CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Provide a GitHub repository and a running app URL. The AI will analyse the codebase,
                generate Playwright test cases, and execute them live with browser screenshots.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8">
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{errorMsg}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
            {/* Left: Configuration */}
            <div className="w-full min-w-0 space-y-5 lg:pr-6 lg:border-r border-border/40">
              <div className="rounded-xl border border-border/50 bg-card/30 p-5 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Github className="h-3.5 w-3.5" /> GitHub Repository URL
                  </label>
                  <Input
                    placeholder="https://github.com/owner/repo"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    disabled={isAnalyzing}
                    className="h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shallow clone + AI analysis uses this repository.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Target App URL (running server)
                  </label>
                  <Input
                    placeholder="http://localhost:3000"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    disabled={isAnalyzing}
                    className="h-10"
                  />
                  {isLocalhost && targetUrl.trim().length > 10 ? (
                    <div className="flex items-start gap-1.5 mt-1 rounded bg-yellow-500/10 border border-yellow-500/20 px-2 py-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-yellow-300 leading-snug">
                        Playwright runs <strong>inside the backend</strong>. Your app must be running
                        on this machine at the port above. Vite default is{" "}
                        <code className="font-mono">:5173</code>, not <code className="font-mono">:8083</code>.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      The app must be running and accessible from this server.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Test Case Type
                  </label>
                  <Select value={testCaseType} onValueChange={setTestCaseType} disabled={isAnalyzing}>
                    <SelectTrigger className="w-full h-10 bg-card/60 border-border/60 hover:border-border focus:ring-primary/20">
                      <SelectValue>
                        {TEST_CASE_TYPES.find((t) => t.value === testCaseType)?.label ?? "Select test type…"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border/60">
                      {TEST_CASE_TYPES.map((type) => (
                        <SelectItem
                          key={type.value}
                          value={type.value}
                          className="cursor-pointer focus:bg-primary/10 data-[state=checked]:bg-primary/10 py-2.5"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-[13px] text-foreground">{type.label}</span>
                            <span className="text-[11px] text-muted-foreground leading-snug">{type.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(() => {
                    const sel = TEST_CASE_TYPES.find((t) => t.value === testCaseType);
                    return sel ? (
                      <p className="text-[11px] text-muted-foreground">{sel.desc}</p>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card/30 p-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5" /> What to Test
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Optional — helps the AI focus test generation.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TEST_TYPE_CHIPS.map(({ label, icon: Icon }) => (
                      <button
                        key={label}
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => toggleChip(label)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                          selectedChips.has(label)
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-muted/40 border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <p className="text-[11px] text-muted-foreground">
                    Provide extra context, edge cases, and expected behaviors.
                  </p>
                  <Textarea
                    placeholder="e.g. Focus on authentication flows and form validation. Test happy paths and error cases for task creation."
                    value={testPreferences}
                    onChange={(e) => setTestPreferences(e.target.value)}
                    disabled={isAnalyzing}
                    className="min-h-[110px] text-xs resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Right: Control panel */}
            <div className="w-full min-w-0 rounded-xl border border-border/50 bg-muted/20 p-5 flex flex-col gap-5 self-start">
              <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Login Credentials</p>
                  <p className="text-[11px] text-muted-foreground">
                    Optional — used for apps that require sign-in.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground">Email / Username</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      disabled={isAnalyzing}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={testPassword}
                        onChange={(e) => setTestPassword(e.target.value)}
                        disabled={isAnalyzing}
                        className="h-10 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px]"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? "hide" : "show"}
                      </button>
                    </div>
                  </div>
                </div>

                {testEmail && (
                  <p className="text-[11px] text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Credentials will be injected into login test steps
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Testing Scope</p>
                  <p className="text-[11px] text-muted-foreground">
                    Choose whether to test the entire app or target a commit.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {(["full", "commit"] as const).map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      disabled={isAnalyzing}
                      onClick={() => {
                        setTestingScope(scope);
                        setSelectedCommit(null);
                      }}
                      className={`flex items-start gap-3 px-3 py-3 rounded-lg border text-left transition-colors ${
                        testingScope === scope
                          ? "bg-primary/15 border-primary/50"
                          : "bg-muted/30 border-border/40 hover:border-primary/30"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${
                        testingScope === scope
                          ? "bg-primary/10 border-primary/25 text-primary"
                          : "bg-background/40 border-border/50 text-muted-foreground"
                      }`}>
                        {scope === "full" ? <Workflow className="h-4 w-4" /> : <GitCommit className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[12px] font-semibold ${testingScope === scope ? "text-primary" : "text-foreground"}`}>
                          {scope === "full" ? "Entire App" : "Specific Commit"}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                          {scope === "full"
                            ? "Analyse the full codebase and generate broad coverage"
                            : "Generate tests based on one commit's changes"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {testingScope === "commit" && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!githubUrl.trim().startsWith("https://") || isFetchingCommits || isAnalyzing}
                        onClick={handleFetchCommits}
                        className="text-xs h-8"
                      >
                        {isFetchingCommits ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Fetching…</>
                        ) : (
                          <><Clock className="h-3.5 w-3.5 mr-1.5" />Load Recent Commits</>
                        )}
                      </Button>
                      {commits.length > 0 && (
                        <span className="text-[11px] text-muted-foreground">{commits.length}</span>
                      )}
                    </div>

                    {commits.length > 0 && (
                      <div className="rounded-lg border border-border/50 bg-background/40 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/40">
                          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-muted-foreground">Recent commits</span>
                          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">
                            {commits.length}
                          </Badge>
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {commits.map((c) => (
                            <button
                              key={c.sha}
                              type="button"
                              disabled={isAnalyzing}
                              onClick={() => setSelectedCommit(c)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/20 last:border-b-0 ${
                                selectedCommit?.sha === c.sha
                                  ? "bg-primary/10 border-l-2 border-l-primary"
                                  : "hover:bg-muted/30"
                              }`}
                            >
                              <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                                {c.author.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[12px] font-medium truncate leading-snug ${selectedCommit?.sha === c.sha ? "text-primary" : "text-foreground"}`}>
                                  {c.message}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <span className="font-medium text-foreground/60">{c.author}</span>
                                  <span>·</span>
                                  <span>{c.relative_date}</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <code className="text-[10px] font-mono text-primary/80 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <GitCommit className="h-2.5 w-2.5" />
                                  {c.short_sha}
                                </code>
                                {selectedCommit?.sha === c.sha && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedCommit && (
                      <div className="flex items-center gap-2 rounded bg-primary/10 border border-primary/20 px-3 py-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <p className="text-[11px] text-primary flex-1 min-w-0 truncate">
                          Testing commit <code className="font-mono">{selectedCommit.short_sha}</code>: {selectedCommit.message}
                        </p>
                      </div>
                    )}

                    {!selectedCommit && commits.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Enter a GitHub URL, then load and select a commit.
                      </p>
                    )}
                    {!selectedCommit && commits.length > 0 && (
                      <p className="text-[11px] text-yellow-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Select a commit to continue.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Number of Tests</p>
                    <p className="text-[11px] text-muted-foreground">How many test cases to generate (1–10)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isAnalyzing || numTests <= 1}
                      onClick={() => setNumTests((v) => Math.max(1, v - 1))}
                      className="h-7 w-7 rounded border border-border/60 bg-muted/40 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40 flex items-center justify-center"
                    >−</button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{numTests}</span>
                    <button
                      type="button"
                      disabled={isAnalyzing || numTests >= 10}
                      onClick={() => setNumTests((v) => Math.min(10, v + 1))}
                      className="h-7 w-7 rounded border border-border/60 bg-muted/40 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-40 flex items-center justify-center"
                    >+</button>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-1">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!canSubmit || isAnalyzing}
                  onClick={() => {
                    const typeObj = TEST_CASE_TYPES.find((t) => t.value === testCaseType);
                    const typePrefix = typeObj ? `TEST CASE TYPE: ${typeObj.label} — ${typeObj.prompt}` : "";
                    const combinedPrefs = [typePrefix, testPreferences.trim()].filter(Boolean).join("\n\n");
                    onAnalyze(
                      githubUrl.trim(),
                      targetUrl.trim(),
                      testEmail || undefined,
                      testPassword || undefined,
                      combinedPrefs || undefined,
                      numTests,
                      testingScope,
                      selectedCommit?.sha,
                      selectedCommit?.message,
                    );
                  }}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {testingScope === "commit" ? "Running on commit…" : "Running…"}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run AI Tests
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Disabled until repo + target URL are provided{testingScope === "commit" ? " and a commit is selected" : ""}.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Step progress indicator ───────────────────────────────────────────────────

const STEPS = [
  { key: "cloning",    label: "Cloning repository" },
  { key: "extracting", label: "Extracting source files" },
  { key: "analyzing",  label: "AI analysing codebase" },
  { key: "generating", label: "Generating Playwright tests" },
];

function stepIndex(step: string): number {
  return STEPS.findIndex((s) => s.key === step);
}

// ── Phase: Analysing — live log viewer ───────────────────────────────────────

function AnalyzingPhase({
  jobData,
}: {
  jobData: ReturnType<typeof useLiveTesting>["jobData"];
}) {
  const logs: string[] = jobData?.logs ?? [];
  const currentStep = jobData?.step ?? "pending";
  const currentIdx = stepIndex(currentStep);

  const getLogLineClassName = (line: string) => {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("✓")) return "text-green-400";
    if (trimmed.startsWith("Step")) return "text-primary font-semibold";

    if (trimmed.startsWith("✗")) {
      const rest = trimmed.slice(1).trimStart();
      const hasErrorKeywords = /\b(error|failed|failure|exception|traceback|fatal)\b/i.test(rest);
      const looksLikePath = /^(~?\/|[A-Za-z]:\\)/.test(rest);

      return !hasErrorKeywords && looksLikePath ? "text-white/80" : "text-red-400";
    }

    return "text-white/80";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto space-y-5"
    >
      <div className="text-center space-y-1">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 mb-1">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        </div>
        <h2 className="font-semibold">Analysing codebase…</h2>
        <p className="text-xs text-muted-foreground">This takes 30–90 seconds. Do not close the page.</p>
      </div>

      {/* Step progress */}
      <div className="space-y-2">
        {STEPS.map((s, i) => {
          const done = i < currentIdx || currentStep === "completed";
          const active = i === currentIdx;
          return (
            <div key={s.key} className={`flex items-center gap-3 text-sm rounded-lg p-2.5 border transition-colors ${
              done ? "border-green-500/30 bg-green-500/5" :
              active ? "border-primary/40 bg-primary/5" :
              "border-border/30 bg-transparent text-muted-foreground"
            }`}>
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
              ) : active ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-border/50 flex-shrink-0" />
              )}
              <span className={active ? "text-primary font-medium" : done ? "text-green-400" : ""}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live log terminal */}
      {logs.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-black/50 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-black/40">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
            <span className="text-[10px] text-white ml-2 font-mono">analysis log</span>
          </div>
          <div className="p-3 space-y-0.5 max-h-52 overflow-y-auto font-mono text-white">
            {logs.map((line, i) => (
              <p
                key={i}
                className={`text-[11px] leading-relaxed ${getLogLineClassName(line)}`}
              >
                {line}
              </p>
            ))}
            {/* Blinking cursor */}
            <span className="inline-block h-3 w-1.5 bg-primary/70 animate-pulse" />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Phase: Ready (show analysis + tests, allow run) ───────────────────────────

function ReadyPhase({
  analysis,
  editedTests,
  onExecute,
  onReset,
  onSave,
  isExecuting,
  errorMsg,
  specTargetUrl,
  onSpecTargetUrlChange,
}: {
  analysis: NonNullable<ReturnType<typeof useLiveTesting>["analysis"]>;
  editedTests: PlaywrightTestCase[] | null;
  onExecute: () => void;
  onReset: () => void;
  onSave: (id: string, updates: Partial<PlaywrightTestCase>) => Promise<void>;
  isExecuting: boolean;
  errorMsg: string | null;
  specTargetUrl?: string | null;
  onSpecTargetUrlChange?: (url: string) => void;
}) {
  const tests = editedTests ?? analysis.tests;
  const isSpecUpload = analysis.analysis_id.startsWith("spec-");

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Summary strip */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug">{analysis.summary}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{analysis.tech_stack}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              {analysis.pages.length} pages
            </Badge>
            <Badge variant="outline" className="text-xs">
              {tests.length} tests
            </Badge>
          </div>
        </div>
      </div>

      {/* Two column: pages + flows — only shown for full AI analysis */}
      {analysis.pages.length > 0 && analysis.user_flows.length > 0 && !analysis.analysis_id.startsWith("spec-") && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pages */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Pages Found
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {analysis.pages.map((page) => (
              <div key={page.path} className="rounded-lg bg-muted/30 p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{page.name}</span>
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {page.path}
                  </code>
                </div>
                <p className="text-[11px] text-muted-foreground">{page.description}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {page.key_elements.slice(0, 4).map((el) => (
                    <span
                      key={el}
                      className="text-[10px] bg-background border border-border/50 rounded px-1.5 py-0.5 text-muted-foreground"
                    >
                      {el}
                    </span>
                  ))}
                  {page.key_elements.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{page.key_elements.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* User Flows */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" /> User Flows Identified
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {analysis.user_flows.map((flow) => (
              <div key={flow.name} className="rounded-lg bg-muted/30 p-2.5 space-y-1.5">
                <p className="text-sm font-medium">{flow.name}</p>
                <ol className="space-y-0.5">
                  {flow.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <span className="text-primary/70 font-mono flex-shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Generated test suite — editable */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {analysis.analysis_id.startsWith("spec-") ? "Imported Test Suite" : "Generated Test Suite"} ({tests.length})
          </h2>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Pencil className="h-3 w-3" /> Click the pencil icon to edit any test
          </span>
        </div>
        {tests.map((t) => (
          <TestCaseEditor key={t.id} test={t} onSave={onSave} />
        ))}
      </div>

      {/* Error — show connection-refused help prominently */}
      {errorMsg && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-400">Cannot run tests</p>
          </div>
          <p className="text-xs text-red-300 leading-relaxed">{errorMsg}</p>
          {errorMsg.toLowerCase().includes("not reachable") || errorMsg.toLowerCase().includes("connection refused") ? (
            <div className="mt-2 rounded bg-black/30 border border-red-500/20 p-3 space-y-1">
              <p className="text-[11px] text-yellow-400 font-semibold">How to fix:</p>
              <p className="text-[11px] text-muted-foreground">
                1. Make sure your app is running locally (e.g. <code className="text-yellow-300">npm run dev</code>).
              </p>
              <p className="text-[11px] text-muted-foreground">
                2. Check the correct port — Vite default is <code className="text-yellow-300">5173</code>,
                   not 8083. Try <code className="text-yellow-300">http://localhost:5173</code>.
              </p>
              <p className="text-[11px] text-muted-foreground">
                3. The Playwright browser runs <strong>inside the backend server</strong>, so the URL
                   must be accessible from the same machine.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Target URL field for spec uploads */}
      {isSpecUpload && (
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Target App URL
          </label>
          <Input
            placeholder="https://your-app.vercel.app"
            value={specTargetUrl ?? ""}
            onChange={(e) => onSpecTargetUrlChange?.(e.target.value)}
            disabled={isExecuting}
            className="h-9"
          />
          <p className="text-[11px] text-muted-foreground">The app must be running and accessible from this server.</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button className="flex-1" size="lg" onClick={onExecute} disabled={isExecuting || (isSpecUpload && !specTargetUrl?.trim().startsWith("http"))}>
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting execution…
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Tests Live
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isExecuting}>
          <RotateCcw className="h-4 w-4 mr-2" />
          {isSpecUpload ? "Upload New File" : "New Repo"}
        </Button>
      </div>
    </motion.div>
  );
}

// ── Phase: Executing + Done ───────────────────────────────────────────────────

function ExecutionPhase({
  runStatus,
  onReset,
  phase,
  analysis,
}: {
  runStatus: ReturnType<typeof useLiveTesting>["runStatus"];
  onReset: () => void;
  phase: LiveTestingPhase;
  analysis?: RepoAnalysisResult | null;
}) {
  if (!runStatus) {
    return (
      <div className="flex flex-col items-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Waiting for execution to start…</p>
      </div>
    );
  }

  const { results, total, passed, failed, status } = runStatus;
  const completed = results.filter((r) => r.status === "passed" || r.status === "failed").length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  // Find the currently running test (last step screenshot = live view)
  const runningTest = results.find((r) => r.status === "running");
  const lastTest = results[results.length - 1];
  const activeTest = runningTest ?? lastTest;

  // Get the latest screenshot from the active test
  const latestScreenshot = activeTest?.step_results
    .slice()
    .reverse()
    .find((s) => s.screenshot)?.screenshot ?? null;

  // Get the step currently executing
  const currentStepDesc = runningTest
    ? runningTest.step_results[runningTest.step_results.length - 1]?.step_description
      ?? `Running step ${runningTest.steps_completed + 1} of ${runningTest.total_steps}…`
    : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* ── Live Browser Preview ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/50 bg-black overflow-hidden">
        {/* Browser chrome bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-border/30">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/70" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <div className="h-3 w-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 mx-2 bg-zinc-800 rounded px-2 py-0.5 text-[11px] text-muted-foreground font-mono truncate">
            {activeTest ? `Running: ${activeTest.test_name}` : "Playwright Browser"}
          </div>
          {status === "running" && (
            <div className="flex items-center gap-1.5 text-[11px] text-yellow-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Live</span>
            </div>
          )}
          {status === "completed" && (
            <span className="text-[11px] text-green-400">Done</span>
          )}
        </div>

        {/* Screenshot viewport */}
        <div className="relative aspect-video bg-zinc-950 flex items-center justify-center min-h-[280px]">
          {latestScreenshot ? (
            <motion.img
              key={latestScreenshot.slice(-20)} // key changes → fade transition
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              src={`data:image/png;base64,${latestScreenshot}`}
              alt="Live browser view"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Waiting for first screenshot…</p>
            </div>
          )}

          {/* Current step overlay */}
          {currentStepDesc && status === "running" && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-3 py-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" />
                <p className="text-[12px] text-white truncate">{currentStepDesc}</p>
                {runningTest && (
                  <span className="ml-auto text-[11px] text-muted-foreground flex-shrink-0">
                    step {runningTest.steps_completed}/{runningTest.total_steps}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
            ) : status === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
            <span className="text-sm font-medium">
              {status === "running" ? `Running test ${completed + 1} of ${total}…` : `Completed`}
            </span>
          </div>
          {phase === "done" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadLiveTestReport(runStatus!, analysis)}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download Report
              </Button>
              <Button variant="outline" size="sm" onClick={onReset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New Run
              </Button>
            </div>
          )}
        </div>

        <Progress value={progress} className="h-1.5 mb-3" />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-bold">{total}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
          <div>
            <p className="text-xl font-bold text-green-400">{passed}</p>
            <p className="text-[11px] text-muted-foreground">Passed</p>
          </div>
          <div>
            <p className="text-xl font-bold text-red-400">{failed}</p>
            <p className="text-[11px] text-muted-foreground">Failed</p>
          </div>
        </div>

        {phase === "done" && total > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Success rate</span>
            <span className={`font-bold ${successRate >= 80 ? "text-green-400" : successRate >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {successRate}%
            </span>
          </div>
        )}
      </div>

      {/* ── Per-test results list ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Test Results
        </h2>
        {results.map((result) => (
          <LiveTestCard key={result.test_id} result={result} />
        ))}
        {results.length === 0 && status === "running" && (
          <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting first test…
          </div>
        )}
      </div>

      {runStatus.error && (
        <div className="flex items-start gap-2 rounded bg-red-500/10 border border-red-500/20 p-3">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{runStatus.error}</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

// ── Run Detail Sheet ──────────────────────────────────────────────────────────

function RunDetailSheet({ run, open, onClose }: { run: RunSummaryItem | null; open: boolean; onClose: () => void }) {
  if (!run) return null;
  const rate = run.total > 0 ? Math.round((run.passed / run.total) * 100) : 0;
  const durationSec = run.started_at && run.completed_at
    ? ((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)
    : null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-border/50 bg-card/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full flex-shrink-0 ${
                run.status === "completed" ? "bg-green-400" :
                run.status === "failed" ? "bg-red-400" :
                "bg-yellow-400 animate-pulse"
              }`} />
              <SheetTitle className="text-base font-semibold">Test Run Details</SheetTitle>
            </div>
            {run.status !== "running" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-shrink-0"
                onClick={() => downloadRunSummaryReport(run)}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
              </Button>
            )}
          </div>
          <SheetDescription asChild>
            <div className="flex items-center gap-2 mt-1">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <code className="text-xs font-mono text-muted-foreground">{run.run_id}</code>
            </div>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total", value: run.total, color: "text-foreground" },
                { label: "Passed", value: run.passed, color: "text-green-400" },
                { label: "Failed", value: run.failed, color: "text-red-400" },
                { label: "Rate", value: `${rate}%`, color: rate >= 80 ? "text-green-400" : rate >= 50 ? "text-yellow-400" : "text-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-border/50 bg-card/60 p-3 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Pass rate</span>
                <span className={rate >= 80 ? "text-green-400" : rate >= 50 ? "text-yellow-400" : "text-red-400"}>
                  {rate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${rate >= 80 ? "bg-green-400" : rate >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>

            {/* Meta info */}
            <div className="rounded-xl border border-border/50 bg-card/40 divide-y divide-border/30">
              {[
                { label: "Status", value: run.status },
                run.started_at ? { label: "Started", value: new Date(run.started_at).toLocaleString() } : null,
                run.completed_at ? { label: "Completed", value: new Date(run.completed_at).toLocaleString() } : null,
                durationSec ? { label: "Duration", value: `${durationSec}s` } : null,
              ].filter(Boolean).map((item) => (
                <div key={item!.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground text-[12px]">{item!.label}</span>
                  <span className="font-medium text-[12px] capitalize">{item!.value}</span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Test results */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Test Results ({run.results?.length ?? 0})
              </h3>
              {run.results && run.results.length > 0 ? (
                <div className="space-y-2">
                  {run.results.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 flex items-center gap-3 ${
                        r.status === "passed"
                          ? "border-green-500/25 bg-green-500/5"
                          : r.status === "failed"
                          ? "border-red-500/25 bg-red-500/5"
                          : "border-border/40 bg-card/30"
                      }`}
                    >
                      {r.status === "passed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                      ) : r.status === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="flex-1 text-sm font-medium">{r.test_name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.duration_ms && (
                          <Badge variant="outline" className="text-[10px] font-mono h-5 px-1.5">
                            {(r.duration_ms / 1000).toFixed(1)}s
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 px-1.5 capitalize ${
                            r.status === "passed" ? "border-green-500/40 text-green-400 bg-green-500/10" :
                            r.status === "failed" ? "border-red-500/40 text-red-400 bg-red-500/10" : ""
                          }`}
                        >
                          {r.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-border/40 bg-card/30 p-6 text-center text-muted-foreground text-sm">
                  No detailed results available for this run.
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ── Run history panel (shown on idle screen) ─────────────────────────────────

function RunHistoryPanel() {
  const { data, isLoading } = useRunHistory();
  const runs: RunSummaryItem[] = data?.runs ?? [];
  const [selectedRun, setSelectedRun] = useState<RunSummaryItem | null>(null);

  if (isLoading) return null;
  if (runs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto mt-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground">Recent Test Runs</h2>
        </div>
        <Badge variant="outline" className="text-[10px]">{runs.length} runs</Badge>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 divide-y divide-border/30 overflow-hidden">
        {runs.slice(0, 10).map((run) => {
          const rate = run.total > 0 ? Math.round((run.passed / run.total) * 100) : 0;
          return (
            <div key={run.run_id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
              {/* Status dot */}
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                run.status === "completed" ? "bg-green-400" :
                run.status === "failed" ? "bg-red-400" :
                "bg-yellow-400 animate-pulse"
              }`} />

              {/* Commit-hash style run ID */}
              <code className="text-[10px] font-mono text-primary/70 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded flex-shrink-0">
                {run.run_id.slice(0, 7)}
              </code>

              {/* Pass rate bar */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${rate >= 80 ? "bg-green-400" : rate >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0 font-medium">
                    {run.passed}/{run.total} passed
                  </span>
                </div>
              </div>

              {/* Date */}
              {run.started_at && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden sm:block">
                  {new Date(run.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}

              {/* View details button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-[11px] flex-shrink-0 gap-1.5"
                onClick={() => setSelectedRun(run)}
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </Button>
            </div>
          );
        })}
      </div>

      {/* Detail sheet */}
      <RunDetailSheet
        run={selectedRun}
        open={selectedRun !== null}
        onClose={() => setSelectedRun(null)}
      />
    </motion.div>
  );
}

// ── sessionStorage prefill (from ViewEntryTree "Run Test Cases" wizard) ────────

interface LtrPrefill {
  appUrl?: string;
  githubUrl?: string;
}

function readAndClearPrefill(): LtrPrefill | null {
  try {
    const raw = sessionStorage.getItem("ltr_prefill");
    if (!raw) return null;
    sessionStorage.removeItem("ltr_prefill");
    return JSON.parse(raw) as LtrPrefill;
  } catch {
    return null;
  }
}

export default function LiveTestRunner({
  onRunComplete,
  initialGithubUrl,
  initialAppUrl,
}: {
  onRunComplete?: (summary: { passed: number; failed: number; total: number; pass_rate: number }) => void;
  initialGithubUrl?: string;
  initialAppUrl?: string;
} = {}) {
  // Read sessionStorage prefill once on mount (from ViewEntryTree wizard)
  const prefill = useMemo(() => readAndClearPrefill(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveGithubUrl = initialGithubUrl ?? prefill?.githubUrl;
  const effectiveAppUrl = initialAppUrl ?? prefill?.appUrl;

  const {
    phase,
    jobData,
    analysis,
    editedTests,
    saveTest,
    runStatus,
    errorMsg,
    handleAnalyze,
    handleExecute,
    handleUploadSpec,
    reset,
    specTargetUrl,
    setSpecTargetUrl,
    isStarting,
    isExecuting,
    isParsingSpec,
  } = useLiveTesting();

  // Fire onRunComplete once when run transitions to done
  const reportedRef = useCallback(() => {}, []);
  if (phase === "done" && runStatus && onRunComplete) {
    const t = runStatus.total ?? 0;
    const p = runStatus.passed ?? 0;
    const f = runStatus.failed ?? 0;
    const key = `${runStatus.run_id}-reported`;
    if (t > 0 && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      onRunComplete({ passed: p, failed: f, total: t, pass_rate: t > 0 ? Math.round((p / t) * 100) : 0 });
    }
  }
  void reportedRef; // suppress unused warning

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <InputPhase
            key="input"
            onAnalyze={(g, t, e, p, prefs, numTests, mode, sha, msg) => handleAnalyze(g, t, e, p, prefs, numTests, mode, sha, msg)}
            onUploadSpec={(file, targetUrl, email, password) => handleUploadSpec(file, targetUrl, email, password)}
            isAnalyzing={isStarting}
            isParsing={isParsingSpec}
            errorMsg={errorMsg}
            initialGithubUrl={effectiveGithubUrl}
            initialAppUrl={effectiveAppUrl}
          />
        )}

        {phase === "analyzing" && (
          <AnalyzingPhase key="analyzing" jobData={jobData} />
        )}

        {phase === "ready" && analysis && (
          <ReadyPhase
            key="ready"
            analysis={analysis}
            editedTests={editedTests}
            onExecute={handleExecute}
            onReset={reset}
            onSave={saveTest}
            isExecuting={isExecuting}
            errorMsg={errorMsg}
            specTargetUrl={specTargetUrl}
            onSpecTargetUrlChange={setSpecTargetUrl}
          />
        )}

        {(phase === "executing" || phase === "done") && (
          <ExecutionPhase
            key="execution"
            runStatus={runStatus}
            onReset={reset}
            phase={phase}
            analysis={analysis}
          />
        )}
      </AnimatePresence>

      {phase === "idle" && <RunHistoryPanel />}
    </div>
  );
}
