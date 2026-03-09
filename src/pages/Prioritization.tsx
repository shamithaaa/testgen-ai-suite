import { motion } from "framer-motion";
import { ArrowUpDown, AlertTriangle, AlertOctagon, Shield, Bug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mockPrioritizedTests } from "@/lib/mockData";

const statusConfig = {
  failed: { color: "bg-destructive/15 text-destructive border-destructive/20", label: "Failed" },
  warning: { color: "bg-warning/15 text-warning border-warning/20", label: "At Risk" },
  stable: { color: "bg-success/15 text-success border-success/20", label: "Stable" },
};

const Prioritization = () => {
  const high = mockPrioritizedTests.filter((t) => t.priority >= 80);
  const medium = mockPrioritizedTests.filter((t) => t.priority >= 40 && t.priority < 80);
  const low = mockPrioritizedTests.filter((t) => t.priority < 40);
  const knownFailures = mockPrioritizedTests.filter((t) => t.knownFailure);

  const sections = [
    { label: "High Priority", icon: AlertOctagon, items: high, accent: "text-destructive", border: "border-l-destructive" },
    { label: "Medium Priority", icon: AlertTriangle, items: medium, accent: "text-warning", border: "border-l-warning" },
    { label: "Low Priority", icon: Shield, items: low, accent: "text-success", border: "border-l-success" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Test Prioritization</h1>
          <p className="text-muted-foreground">AI-ranked test execution order based on failure history and risk</p>
        </div>

        {/* Known Failures */}
        {knownFailures.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="floating-card mb-6 border-destructive/30"
          >
            <div className="p-4 border-b border-border/30 flex items-center gap-2">
              <Bug className="h-4 w-4 text-destructive" />
              <span className="font-display font-semibold text-sm">Known Failures – Awaiting Fix</span>
              <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/20 text-xs ml-2">
                {knownFailures.length}
              </Badge>
            </div>
            <div className="divide-y divide-border/20">
              {knownFailures.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground w-16">{t.id}</span>
                    <span className="text-sm">{t.name}</span>
                    <Badge className="bg-destructive/20 text-destructive text-[10px] border-none">Known Failure</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{t.failureCount} failures</span>
                    <span className="font-mono text-xs font-semibold text-destructive">{t.priority}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Priority Sections */}
        <div className="space-y-4">
          {sections.map((section, si) => (
            <motion.div
              key={section.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + si * 0.1 }}
              className="floating-card overflow-hidden"
            >
              <div className="p-4 border-b border-border/30 flex items-center gap-2">
                <section.icon className={`h-4 w-4 ${section.accent}`} />
                <span className="font-display font-semibold text-sm">{section.label}</span>
                <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs ml-2">
                  {section.items.length}
                </Badge>
              </div>

              {section.items.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No tests in this priority level</p>
              ) : (
                <div className="divide-y divide-border/20">
                  {section.items.map((t, i) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className={`flex items-center justify-between px-4 py-3 border-l-2 ${section.border} hover:bg-muted/10 transition-colors`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground w-16">{t.id}</span>
                        <span className="text-sm">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">{t.failureCount} failures</div>
                          <div className="text-[10px] text-muted-foreground">{t.severity}</div>
                        </div>
                        <div className="w-10 text-center">
                          <span className="font-mono text-sm font-bold">{t.priority}</span>
                        </div>
                        <Badge variant="outline" className={`text-xs ${statusConfig[t.status].color}`}>
                          {statusConfig[t.status].label}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Prioritization;
