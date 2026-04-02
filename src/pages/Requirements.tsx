import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Loader2, FileText, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAnalyzeRequirement } from "@/hooks/use-requirements";

const exampleRequirement = "Truck sends engine health data to fleet platform every 30 seconds. The data includes engine temperature, RPM, oil pressure, fuel level, GPS coordinates, and vehicle speed. The fleet platform processes and stores the data for real-time monitoring and historical analysis.";

const Requirements = () => {
  const [requirement, setRequirement] = useState("");
  const [instructions, setInstructions] = useState("");
  const navigate = useNavigate();
  const analyzeMutation = useAnalyzeRequirement();

  const isAnalyzing = analyzeMutation.isPending;

  const handleGenerate = async () => {
    if (!requirement.trim()) return;
    try {
      const result = await analyzeMutation.mutateAsync({ text: requirement, instructions });
      localStorage.setItem("lastRequirementId", result.id);
      navigate("/generated-tests");
    } catch {
      // error shown via analyzeMutation.isError
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Step banner */}
        <div className="flex items-center gap-3 mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
          <div className="h-9 w-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 font-display font-bold text-primary text-sm">1</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-display font-semibold text-sm">Step 1 of 4 — Submit Requirement</span>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">Start Here</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Provide a software requirement in plain language. The AI engine will automatically generate a complete test suite covering functional, edge case, API validation, failure, and regression scenarios.</p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-muted-foreground/40 text-xs shrink-0">
            <span>→ Step 2: Review Test Suite</span>
            <span>→ Step 3: Execute</span>
            <span>→ Step 4: Prioritize</span>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold mb-1">Requirement Analysis</h1>
          <p className="text-muted-foreground text-sm">Submit a software requirement below. The AI engine will generate a comprehensive, structured test suite automatically.</p>
        </div>

        <div className="floating-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-display font-medium">Requirement Description</span>
          </div>

          <Textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="Describe the software requirement, system behavior, or feature specification..."
            className="min-h-[180px] bg-muted/30 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/20 resize-none text-sm font-mono mb-4"
          />

          <div className="flex items-center gap-2 mb-4 mt-6">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-display font-medium">Additional Testing Guidance (Optional)</span>
          </div>

          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Prioritize API error response validation, or simulate network interruption and offline scenarios..."
            className="min-h-[80px] bg-muted/30 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/20 resize-none text-sm font-mono mb-6"
          />

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-xs"
              onClick={() => setRequirement(exampleRequirement)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Load Sample Requirement
            </Button>

            <Button
              onClick={handleGenerate}
              disabled={!requirement.trim() || isAnalyzing}
              className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary font-display"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Requirement...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Generate Test Suite
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Loading overlay */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-8 floating-card p-8 text-center"
            >
              <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-display font-semibold mb-2">Analyzing requirement and generating test suite...</h3>
              <p className="text-sm text-muted-foreground">Structuring test cases, identifying edge conditions, and preparing synthetic data configurations</p>
              {(analyzeMutation as any).isError && (
                <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    {((analyzeMutation as any).error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                      ?? ((analyzeMutation as any).error as Error)?.message
                      ?? "Unable to connect to the analysis service. Please verify the server is running on port 8000."}
                  </span>
                </div>
              )}
              <div className="mt-6 h-1 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: "90%" }}
                  transition={{ duration: 2.2, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Requirements;
