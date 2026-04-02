import { useState } from "react";
import { motion } from "framer-motion";
import {
  Database, Sparkles, Loader2, ChevronDown, Table2,
  Info, Hash, Type, ToggleLeft, Clock, RefreshCw,
} from "lucide-react";
import { useSyntheticDatasets, useGenerateSyntheticData } from "@/hooks/use-synthetic-data";
import { useRequirements } from "@/hooks/use-requirements";
import { type SyntheticDataset } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// â”€â”€ tiny helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const typeIcon: Record<string, React.ReactNode> = {
  string:   <Type className="h-3 w-3" />,
  integer:  <Hash className="h-3 w-3" />,
  float:    <Hash className="h-3 w-3" />,
  boolean:  <ToggleLeft className="h-3 w-3" />,
  datetime: <Clock className="h-3 w-3" />,
};

const typeColor: Record<string, string> = {
  string:   "bg-primary/10 text-primary border-primary/20",
  integer:  "bg-secondary/10 text-secondary border-secondary/20",
  float:    "bg-secondary/10 text-secondary border-secondary/20",
  boolean:  "bg-success/10 text-success border-success/20",
  datetime: "bg-warning/10 text-warning border-warning/20",
};

function formatCell(value: unknown, type: string): string {
  if (value === null || value === undefined) return "â€”";
  if (type === "boolean") return value ? "true" : "false";
  if (type === "float" && typeof value === "number") return value.toFixed(2);
  if (type === "datetime" && typeof value === "string") {
    try { return new Date(value).toLocaleString(); } catch { return String(value); }
  }
  return String(value);
}

// â”€â”€ main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SyntheticData = () => {
  const [selectedReqId, setSelectedReqId] = useState("");
  const [count, setCount] = useState(20);
  const [activeDataset, setActiveDataset] = useState<SyntheticDataset | null>(null);

  const { data: requirements = [], isLoading: reqLoading } = useRequirements();
  const { data: datasets = [], isLoading: dsLoading } = useSyntheticDatasets(10);
  const generateMutation = useGenerateSyntheticData();

  const handleGenerate = () => {
    if (!selectedReqId) return;
    generateMutation.mutate(
      { requirement_id: selectedReqId, count },
      {
        onSuccess: (newDataset) => {
          setActiveDataset(newDataset);
        },
      }
    );
  };

  const displayDataset = activeDataset ?? (datasets.length > 0 ? datasets[0] : null);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* â”€â”€ Header â”€â”€ */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Synthetic Test Data Generation</h1>
          <p className="text-muted-foreground">
            The AI engine analyzes your requirement and autonomously designs a tailored data schema with realistic, context-aware records — no predefined templates or hardcoded configurations required.
          </p>
        </div>

        {/* â”€â”€ Generate panel â”€â”€ */}
        <div className="floating-card p-6 mb-6">
          <h2 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate Dataset from Requirement
          </h2>

          <div className="flex flex-wrap gap-3 items-end">
            {/* Requirement selector */}
            <div className="flex-1 min-w-[260px]">
              <label className="block text-xs text-muted-foreground mb-1.5">Requirement</label>
              <div className="relative">
                <select
                  value={selectedReqId}
                  onChange={(e) => setSelectedReqId(e.target.value)}
                  className="w-full text-sm bg-muted/30 border border-border/50 rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-primary/50 text-foreground"
                >
                  <option value="">
                    {reqLoading ? "Loading requirementsâ€¦" : "â€” pick a requirement â€”"}
                  </option>
                  {requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.text.slice(0, 90)}{r.text.length > 90 ? "â€¦" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Row count */}
            <div className="w-28">
              <label className="block text-xs text-muted-foreground mb-1.5">Rows</label>
              <input
                type="number"
                min={5}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.min(100, Math.max(5, Number(e.target.value))))}
                className="w-full text-sm bg-muted/30 border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 text-foreground font-mono"
              />
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!selectedReqId || generateMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-display glow-primary h-[38px]"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Asking Geminiâ€¦</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Generate</>
              )}
            </Button>
          </div>

          {generateMutation.isError && (
            <p className="text-destructive text-xs mt-3">
              {(generateMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                ?? (generateMutation.error as Error)?.message
                ?? "Generation failed — check backend logs."}
            </p>
          )}
        </div>

        {/* â”€â”€ Past datasets switcher â”€â”€ */}
        {datasets.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {datasets.map((ds, i) => (
              <button
                key={ds.id}
                onClick={() => setActiveDataset(ds)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-colors ${
                  (displayDataset?.id === ds.id)
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                #{i + 1} Â· {ds.requirement_text.slice(0, 40)}{ds.requirement_text.length > 40 ? "â€¦" : ""} Â· {ds.count} rows
              </button>
            ))}
          </div>
        )}

        {/* â”€â”€ Dataset view â”€â”€ */}
        {dsLoading && (
          <div className="floating-card p-10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!dsLoading && !displayDataset && !generateMutation.isPending && (
          <div className="floating-card p-10 text-center text-muted-foreground text-sm">
            <Database className="h-8 w-8 mx-auto mb-3 opacity-30" />
            No datasets available. Select a requirement above and initiate dataset generation.
          </div>
        )}

        {generateMutation.isPending && (
          <div className="floating-card p-10 text-center text-muted-foreground text-sm">
            <Sparkles className="h-8 w-8 mx-auto mb-3 animate-pulse text-primary" />
            <p className="font-display font-semibold">Gemini is designing your schema and filling the rowsâ€¦</p>
            <p className="text-xs mt-1 opacity-60">This usually takes 5â€“15 seconds.</p>
          </div>
        )}

        {displayDataset && !generateMutation.isPending && (
          <motion.div
            key={displayDataset.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            {/* Schema chips */}
            <div className="floating-card p-5">
              <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                AI-Designed Data Schema
                <Badge variant="secondary" className="ml-auto text-xs">
                  {displayDataset.schema_fields.length} fields
                </Badge>
              </h3>
              <div className="flex flex-wrap gap-2">
                {displayDataset.schema_fields.map((f) => (
                  <div
                    key={f.name}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono ${typeColor[f.type] ?? "bg-muted text-muted-foreground border-border/30"}`}
                    title={f.description}
                  >
                    {typeIcon[f.type]}
                    {f.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Data table */}
            <div className="floating-card overflow-hidden">
              <div className="p-4 border-b border-border/30 flex items-center gap-2">
                <Table2 className="h-4 w-4 text-primary" />
                <span className="font-display font-semibold text-sm">Generated Data Table</span>
                <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs ml-2">
                  {displayDataset.rows.length} rows
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground font-mono opacity-60">
                  {new Date(displayDataset.generated_at).toLocaleString()}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/30">
                      <th className="px-4 py-3 text-left font-display font-medium text-muted-foreground w-12">#</th>
                      {displayDataset.schema_fields.map((f) => (
                        <th key={f.name} className="px-4 py-3 text-left font-display font-medium text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="opacity-60">{typeIcon[f.type]}</span>
                            {f.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayDataset.rows.map((row, i) => (
                      <motion.tr
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.015 }}
                        className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-muted-foreground/50">{i + 1}</td>
                        {displayDataset.schema_fields.map((f) => (
                          <td key={f.name} className="px-4 py-3 font-mono">
                            {formatCell(row[f.name], f.type)}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default SyntheticData;
