import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Loader2, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAnalyzeRequirement } from "@/hooks/use-requirements";

const exampleRequirement = "Truck sends engine health data to fleet platform every 30 seconds. The data includes engine temperature, RPM, oil pressure, fuel level, GPS coordinates, and vehicle speed. The fleet platform processes and stores the data for real-time monitoring and historical analysis.";

const Requirements = () => {
  const [requirement, setRequirement] = useState("");
  const navigate = useNavigate();
  const analyzeMutation = useAnalyzeRequirement();

  const isAnalyzing = analyzeMutation.isPending;

  const handleGenerate = async () => {
    if (!requirement.trim()) return;
    try {
      const result = await analyzeMutation.mutateAsync(requirement);
      localStorage.setItem("lastRequirementId", result.id);
      navigate("/generated-tests");
    } catch {
      // error shown via analyzeMutation.isError
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Requirement Analysis</h1>
          <p className="text-muted-foreground">Paste your software requirement and let AI generate comprehensive test cases.</p>
        </div>

        <div className="floating-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-display font-medium">Requirement Input</span>
          </div>

          <Textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="Describe your software requirement here..."
            className="min-h-[180px] bg-muted/30 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-primary/20 resize-none text-sm font-mono mb-4"
          />

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-xs"
              onClick={() => setRequirement(exampleRequirement)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Use example requirement
            </Button>

            <Button
              onClick={handleGenerate}
              disabled={!requirement.trim() || isAnalyzing}
              className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary font-display"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Generate Test Cases
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
              <h3 className="font-display font-semibold mb-2">AI is analyzing your requirement...</h3>
              <p className="text-sm text-muted-foreground">Generating test cases, identifying edge cases, and preparing synthetic data</p>
              {analyzeMutation.isError && (
                <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Failed to connect to backend. Is the server running on port 8000?</span>
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
