import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Sparkles,
  Database,
  Layers,
  ChevronUp,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type WorkspacePlaywrightTest } from "@/lib/api";

const severityClass: Record<string, string> = {
  Critical: "bg-red-500/15 text-red-400 border-red-500/30",
  High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

interface FileGroup {
  filePath: string;
  tests: WorkspacePlaywrightTest[];
}

export function UnifiedTestIntelligence({ tests }: { tests: WorkspacePlaywrightTest[] }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const sessionTests = tests.filter(t => (t as any).source === "session");
  const baselineTests = tests.filter(t => (t as any).source === "baseline");

  const buildGroups = (testList: WorkspacePlaywrightTest[]) => {
    return testList.reduce<FileGroup[]>((acc, t) => {
      const key = t.page_name || "Unknown";
      const existing = acc.find((g) => g.filePath === key);
      if (existing) {
        existing.tests.push(t);
      } else {
        acc.push({ filePath: key, tests: [t] });
      }
      return acc;
    }, []);
  };

  const sessionGroups = buildGroups(sessionTests);
  const baselineGroups = buildGroups(baselineTests);

  const allFilePaths = Array.from(new Set([...sessionGroups.map(g => g.filePath), ...baselineGroups.map(g => g.filePath)]));
  const allGroups = allFilePaths.map(fp => ({
    filePath: fp,
    sessionTests: sessionGroups.find(g => g.filePath === fp)?.tests || [],
    baselineTests: baselineGroups.find(g => g.filePath === fp)?.tests || []
  }));

  const toggleFile = (fp: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fp)) next.delete(fp);
      else next.add(fp);
      return next;
    });
  };

  const toggleTest = (id: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function renderTestItem(test: WorkspacePlaywrightTest, theme: "orange" | "blue") {
    const isExpanded = expandedTests.has(test.id);
    return (
      <div
        key={test.id}
        className={cn(
          "group relative flex flex-col gap-0 rounded-2xl border transition-all overflow-hidden",
          theme === "orange" ? "border-orange-500/10 bg-orange-500/[0.02]" : "border-blue-500/10 bg-blue-500/[0.02]",
          isExpanded && (theme === "orange" ? "border-orange-500/30 ring-1 ring-orange-500/10" : "border-blue-500/30 ring-1 ring-blue-500/10")
        )}
      >
        <button 
           onClick={() => toggleTest(test.id)}
           className="flex items-center gap-3 py-3 px-4 w-full text-left hover:bg-white/5 transition-colors"
        >
          <div className={cn(
            "absolute left-1 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full transition-all opacity-40 group-hover:opacity-100",
            theme === "orange" ? "bg-orange-500/50 group-hover:bg-orange-500" : "bg-blue-500/50 group-hover:bg-blue-500"
          )} />
          <FlaskConical className={cn("h-4 w-4 shrink-0", theme === "orange" ? "text-orange-400/60" : "text-blue-400/60")} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-foreground/80 group-hover:text-foreground transition-colors truncate uppercase tracking-tight">
              {test.name}
            </p>
            {test.description && (
              <p className="text-[9px] text-muted-foreground truncate opacity-60 italic leading-tight">{test.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge 
              variant="outline" 
              className={cn(
                "text-[8px] h-4 px-1.5 font-black shrink-0 tracking-tighter uppercase",
                severityClass[test.severity.charAt(0).toUpperCase() + test.severity.slice(1).toLowerCase()] ?? "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {test.severity.slice(0, 3)}
            </Badge>
            {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground/60" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="mt-2 space-y-1.5 border-l border-border/40 pl-4 py-1 ml-1.5">
              {test.steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-[10px] py-1 group/step">
                  <span className="text-[9px] font-mono text-muted-foreground/40 mt-0.5 w-3 text-right">{idx + 1}</span>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-black uppercase tracking-widest text-[8px] px-1.5 py-0.5 rounded",
                          theme === "orange" 
                            ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" 
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        )}>
                          {step.action}
                        </span>
                       <span className="font-mono text-foreground/70 truncate max-w-[200px]">
                         {step.selector || step.value || "—"}
                       </span>
                    </div>
                    {step.description && (
                      <p className="text-[9px] text-muted-foreground font-medium italic opacity-70">{step.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Selection Summary Bar ────────────────────────────────────────────── */}
      <div className={cn(
        "grid grid-cols-1 gap-4 pb-2",
        baselineTests.length > 0 ? "md:grid-cols-3" : "md:grid-cols-2"
      )}>
        <div className="p-4 rounded-3xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 backdrop-blur-sm group hover:border-orange-500/40 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-orange-500/10 border border-orange-500/20 group-hover:scale-110 transition-transform">
              <Sparkles className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-400/70">Session Intelligence</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tabular-nums tracking-tighter">{sessionTests.length}</span>
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">Units active</span>
              </div>
            </div>
          </div>
        </div>

        {baselineTests.length > 0 && (
          <div className="p-4 rounded-3xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 backdrop-blur-sm group hover:border-blue-500/40 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-blue-500/10 border border-blue-500/20 group-hover:scale-110 transition-transform">
                <Database className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/70">Persistent Baseline</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tabular-nums tracking-tighter">{baselineTests.length}</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">Units merged</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 backdrop-blur-sm group hover:border-primary/40 transition-all shadow-[0_0_30px_rgba(var(--primary),0.05)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Total Suite Coverage</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tabular-nums tracking-tighter">{tests.length}</span>
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">Total active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border/40 bg-card/60 backdrop-blur-md rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-500">
        <div className="bg-primary/5 px-6 py-4 flex items-center justify-between border-b border-border/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight uppercase">Execution Plan Orchestration</h3>
              <p className="text-[10px] text-muted-foreground font-medium">Configure and verify tests from diverse intelligence streams</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-background/80 border-primary/30 text-primary font-bold px-3 py-1 rounded-lg">
              {tests.length} Units Ready
            </Badge>
            <button
              className="p-1.5 hover:bg-primary/10 rounded-lg transition-all text-muted-foreground hover:text-primary"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="p-6 bg-gradient-to-b from-transparent to-background/20">
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
              {allGroups.length === 0 ? (
                <div className="py-20 text-center rounded-[2.5rem] border border-dashed border-border/20 bg-muted/5 space-y-4">
                  <div className="p-4 w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 mx-auto transition-transform flex items-center justify-center">
                    <Plus className="h-8 w-8 text-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground/80 uppercase tracking-widest">No Active Intelligence Units</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">Switch to Growth Mode to generate or enable Repo Baseline.</p>
                  </div>
                </div>
              ) : (
                allGroups.map((group) => {
                  const isOpen = expandedFiles.has(group.filePath);
                  return (
                    <div key={group.filePath} className={cn(
                      "border rounded-[1.5rem] overflow-hidden transition-all duration-300",
                      isOpen ? "border-primary/20 shadow-xl ring-1 ring-primary/5 bg-card/40" : "border-border/30 hover:border-primary/20 bg-card/20",
                    )}>
                      <button
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/10 transition-colors"
                        onClick={() => toggleFile(group.filePath)}
                      >
                        <div className="relative">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-[13px] font-black uppercase tracking-tight text-foreground/90">{group.filePath}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            {group.sessionTests.length > 0 && (
                                <Badge variant="outline" className="bg-orange-500/10 border-orange-500/20 text-orange-400 text-[8px] h-4 tracking-widest font-black uppercase">
                                    {group.sessionTests.length} Session
                                </Badge>
                            )}
                            {group.baselineTests.length > 0 && (
                                <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20 text-blue-400 text-[8px] h-4 tracking-widest font-black uppercase">
                                    {group.baselineTests.length} Baseline
                                </Badge>
                            )}
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                           {group.sessionTests.length > 0 && (
                             <div className="space-y-3">
                               <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-400/60 ml-1">New Session Units</p>
                               <div className="grid grid-cols-1 gap-2">
                                 {group.sessionTests.map(t => renderTestItem(t, "orange"))}
                               </div>
                             </div>
                           )}
                           {group.baselineTests.length > 0 && (
                             <div className="space-y-3">
                               <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400/60 ml-1">Production Baseline Units</p>
                               <div className="grid grid-cols-1 gap-2">
                                 {group.baselineTests.map(t => renderTestItem(t, "blue"))}
                               </div>
                             </div>
                           )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
