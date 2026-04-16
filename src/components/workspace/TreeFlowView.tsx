import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Handle,
  Position,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  FileCode,
  FileText,
  GitBranch,
  Flame,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Loader2,
  Code2,
  Copy,
  Check,
  ArrowLeft,
  FlaskConical,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  api,
  impactApi,
  type CommitImpactTreeNode,
  type GraphEdge,
  type GraphNode,
  type WorkspacePlaywrightTest,
  type WorkspaceTestStep,
} from "@/lib/api";
import { useWorkspaceContext } from "@/context/WorkspaceContext";
import { useCommitImpactTree } from "@/hooks/use-commit-impact";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  M: "text-orange-400",
  U: "text-sky-400",
  A: "text-green-400",
  D: "text-red-400",
  modified: "text-orange-400",
  untracked: "text-sky-400",
  staged: "text-green-400",
  deleted: "text-red-400",
};

const SEVERITY_STYLE: Record<string, string> = {
  Critical: "bg-red-500/15 text-red-400 border-red-500/30",
  High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

interface FlowNodeData extends Record<string, unknown> {
  label: string;
  path: string;
  status?: string;
  isRoot?: boolean;
  isLeaf?: boolean;
  isEntry?: boolean;
  depth?: number;
  importsCount?: number;
  impactedByCount?: number;
}

interface FileTestGroup {
  filePath: string;
  tests: WorkspacePlaywrightTest[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileIcon(path: string, isEntry?: boolean) {
  if (isEntry) return <Flame className="h-4 w-4 text-orange-400 flex-shrink-0" />;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "py"].includes(ext))
    return <FileCode className="h-4 w-4 text-blue-400 flex-shrink-0" />;
  return <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
}

function flattenImpactTree(
  nodes: CommitImpactTreeNode[],
  map = new Map<string, CommitImpactTreeNode>(),
): Map<string, CommitImpactTreeNode> {
  for (const n of nodes) {
    map.set(n.path, n);
    if (n.children) flattenImpactTree(n.children, map);
  }
  return map;
}

function findPathToTarget(
  nodes: CommitImpactTreeNode[],
  target: string,
): string[] | null {
  for (const node of nodes) {
    if (node.path === target) return [node.path];
    const child = findPathToTarget(node.children ?? [], target);
    if (child) return [node.path, ...child];
  }
  return null;
}

function deriveRootToLeafChain(
  focusPath: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): string[] {
  if (!focusPath || nodes.length === 0) return [];

  const nodeSet = new Set(nodes.map((n) => n.path));
  if (!nodeSet.has(focusPath)) return [];

  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();

  for (const edge of edges) {
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) continue;

    if (!parentMap.has(edge.target)) parentMap.set(edge.target, []);
    parentMap.get(edge.target)!.push(edge.source);

    if (!childMap.has(edge.source)) childMap.set(edge.source, []);
    childMap.get(edge.source)!.push(edge.target);
  }

  const walkToRoot = (node: string, visited: Set<string>): string[] => {
    if (visited.has(node)) return [node];
    const parents = [...(parentMap.get(node) ?? [])].sort();
    if (parents.length === 0) return [node];

    let bestPath = [node];
    for (const parent of parents) {
      const candidate = [...walkToRoot(parent, new Set([...visited, node])), node];
      if (candidate.length > bestPath.length) bestPath = candidate;
    }
    return bestPath;
  };

  const walkToLeaf = (node: string, visited: Set<string>): string[] => {
    if (visited.has(node)) return [node];
    const children = [...(childMap.get(node) ?? [])].sort();
    if (children.length === 0) return [node];

    let bestPath = [node];
    for (const child of children) {
      const candidate = [node, ...walkToLeaf(child, new Set([...visited, node]))];
      if (candidate.length > bestPath.length) bestPath = candidate;
    }
    return bestPath;
  };

  const upstream = walkToRoot(focusPath, new Set());
  const downstream = walkToLeaf(focusPath, new Set());
  return [...upstream, ...downstream.slice(1)];
}

// ── Playwright code formatter ─────────────────────────────────────────────────

function formatStepCode(step: WorkspaceTestStep): string {
  switch (step.action) {
    case "navigate":
      return `  await page.goto('${step.value}');`;
    case "click":
      return `  await page.click('${step.selector}');`;
    case "fill":
      return `  await page.fill('${step.selector}', '${step.value}');`;
    case "assert_text":
      return `  await expect(page.locator('body')).toContainText('${step.value}');`;
    case "screenshot":
      return `  await page.screenshot({ path: 'screenshots/step.png' });`;
    case "wait":
      return `  await page.waitForTimeout(${parseInt(step.value ?? "2") * 1000});`;
    case "hover":
      return `  await page.hover('${step.selector}');`;
    case "hover_and_click":
      return `  await page.hover('${step.selector}');\n  await page.click('${step.value}');`;
    case "press":
      return `  await page.press('${step.selector ?? "body"}', '${step.value}');`;
    case "check":
      return `  await page.check('${step.selector}');`;
    case "uncheck":
      return `  await page.uncheck('${step.selector}');`;
    case "select_option":
      return `  await page.selectOption('${step.selector}', '${step.value}');`;
    case "dblclick":
      return `  await page.dblclick('${step.selector}');`;
    case "type_into":
      return `  await page.type('${step.selector}', '${step.value}');`;
    case "scroll":
      return `  await page.locator('${step.selector}').scrollIntoViewIfNeeded();`;
    case "clear":
      return `  await page.fill('${step.selector}', '');`;
    default:
      return `  // ${step.action}: ${step.description}`;
  }
}

function formatTestToSpec(test: WorkspacePlaywrightTest): string {
  const stepsCode = test.steps
    .map((s) => {
      const code = formatStepCode(s);
      return `  // ${s.description}\n${code}`;
    })
    .join("\n\n");

  return `import { test, expect } from '@playwright/test';

test('${test.name}', async ({ page }) => {
  // ${test.description}
${stepsCode}
});`;
}

// ── Flow layout ───────────────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 68;
const X_GAP = 100;
const Y_GAP = 100;

function buildBranchFlow(
  focusPath: string,
  chain: string[],
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
  impactNodeMap: Map<string, CommitImpactTreeNode>,
): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map(graphNodes.map((n) => [n.path, n]));
  const allSet = new Set(graphNodes.map((n) => n.path));

  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();
  for (const edge of graphEdges) {
    if (!allSet.has(edge.source) || !allSet.has(edge.target)) continue;

    if (!parentMap.has(edge.target)) parentMap.set(edge.target, []);
    parentMap.get(edge.target)!.push(edge.source);

    if (!childMap.has(edge.source)) childMap.set(edge.source, []);
    childMap.get(edge.source)!.push(edge.target);
  }

  const subset = new Set<string>(chain.length > 0 ? chain : [focusPath]);

  const roots = [...subset].filter((p) => ((parentMap.get(p) ?? []).filter((x) => subset.has(x)).length === 0));
  const orderedRoots = roots.length > 0 ? roots : [focusPath];

  const layer = new Map<string, number>();
  const queue: Array<{ path: string; depth: number }> = orderedRoots.map((r) => ({ path: r, depth: 0 }));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const prevDepth = layer.get(current.path);
    if (prevDepth !== undefined && prevDepth >= current.depth) continue;

    layer.set(current.path, current.depth);
    for (const child of childMap.get(current.path) ?? []) {
      if (!subset.has(child)) continue;
      queue.push({ path: child, depth: current.depth + 1 });
    }
  }

  for (const p of subset) {
    if (!layer.has(p)) layer.set(p, 0);
  }

  const chainIndex = new Map<string, number>();
  chain.forEach((p, i) => chainIndex.set(p, i));

  const groups = new Map<number, string[]>();
  for (const p of subset) {
    const d = layer.get(p) ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(p);
  }

  for (const [, arr] of groups) {
    arr.sort((a, b) => {
      const ai = chainIndex.has(a) ? chainIndex.get(a)! : Number.MAX_SAFE_INTEGER;
      const bi = chainIndex.has(b) ? chainIndex.get(b)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });
  }

  const rfNodes: Node[] = [];
  for (const d of [...groups.keys()].sort((a, b) => a - b)) {
    const arr = groups.get(d) ?? [];
    arr.forEach((path, idx) => {
      const impact = impactNodeMap.get(path);
      const graph = nodeMap.get(path);
      const status = impact?.status && impact.status !== " " ? impact.status : undefined;

      rfNodes.push({
        id: path,
        type: "treeFlowNode",
        position: { x: d * (NODE_W + X_GAP), y: idx * Y_GAP },
        data: {
          label: path.split("/").pop() ?? path,
          path,
          status,
          isRoot: chain.length > 0 ? path === chain[0] : idx === 0 && d === 0,
          isLeaf: chain.length > 0 ? path === chain[chain.length - 1] : path === focusPath,
          isEntry: impact?.is_entry ?? false,
          depth: impact?.depth ?? graph?.layer ?? d,
          importsCount: impact?.imports_count ?? 0,
          impactedByCount: impact?.impacted_by_count ?? 0,
        } as FlowNodeData,
        draggable: false,
        selectable: true,
        style: { width: NODE_W, height: NODE_H },
      });
    });
  }

  const chainEdges = new Set<string>();
  for (let i = 0; i < chain.length - 1; i += 1) {
    chainEdges.add(`${chain[i]}->${chain[i + 1]}`);
  }

  const rfEdges: Edge[] = [];
  for (const e of graphEdges) {
    if (!subset.has(e.source) || !subset.has(e.target)) continue;
    const highlighted = chainEdges.has(`${e.source}->${e.target}`);
    rfEdges.push({
      id: `e-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: "step",
      animated: highlighted,
      style: {
        stroke: highlighted ? "#f97316" : "hsl(var(--border))",
        strokeWidth: highlighted ? 2.2 : 1.4,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
        color: highlighted ? "#f97316" : "hsl(var(--border))",
      },
    });
  }

  return { nodes: rfNodes, edges: rfEdges };
}

// ── Custom React Flow node ────────────────────────────────────────────────────

const TreeFlowNode = memo(({ data, selected }: NodeProps) => {
  const d = data as FlowNodeData;
  const status = d.status as string | undefined;

  return (
    <div
      className={cn(
        "h-full w-full rounded-xl border-2 px-3 py-2",
        "flex flex-col justify-between gap-1 cursor-pointer transition-all duration-150",
        "bg-card shadow-md",
        selected
          ? "border-primary ring-2 ring-primary/30 shadow-primary/10"
          : d.isLeaf
          ? "border-primary/60 bg-primary/5"
          : d.isRoot || d.isEntry
          ? "border-orange-400/60 bg-orange-400/5"
          : "border-border/60 hover:border-border",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={{ background: "hsl(var(--border))", width: 6, height: 6, border: "none", left: -4 }}
      />

      <div className="flex items-center gap-2 min-w-0">
        {fileIcon(d.path as string, d.isEntry as boolean | undefined)}
        <span className="font-mono text-[12px] font-semibold text-foreground truncate flex-1">
          {d.label as string}
        </span>
        {status && (
          <span className={cn("text-[10px] font-bold flex-shrink-0", STATUS_STYLE[status] ?? "")}>
            {status}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {d.isRoot && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-orange-400/15 text-orange-400">
            changed root
          </span>
        )}
        {d.isLeaf && !d.isRoot && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary">
            selected
          </span>
        )}
        {d.isEntry && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-orange-400/10 text-orange-300">
            entry
          </span>
        )}
        {!d.isRoot && !d.isLeaf && (
          <span className="text-[9px] text-muted-foreground/50">depth {d.depth}</span>
        )}
        {(d.importsCount as number) > 0 && (
          <span className="ml-auto text-[9px] text-muted-foreground/40">
            {d.importsCount as number} imports
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={{ background: "hsl(var(--border))", width: 6, height: 6, border: "none", right: -4 }}
      />
    </div>
  );
});
TreeFlowNode.displayName = "TreeFlowNode";

const NODE_TYPES = { treeFlowNode: TreeFlowNode };

// ── Flow canvas ───────────────────────────────────────────────────────────────

interface FlowCanvasProps {
  focusPath: string;
  chain: string[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  impactNodeMap: Map<string, CommitImpactTreeNode>;
}

function FlowCanvas({ focusPath, chain, graphNodes, graphEdges, impactNodeMap }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const chainKey = `${focusPath}|${chain.join("|")}|${graphNodes.length}|${graphEdges.length}`;

  useEffect(() => {
    if (chain.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const { nodes: n, edges: e } = buildBranchFlow(focusPath, chain, graphNodes, graphEdges, impactNodeMap);
    setNodes(n);
    setEdges(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainKey]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      panOnDrag={true}
      zoomOnScroll={true}
      fitView
      fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
      proOptions={{ hideAttribution: true }}
      style={{ background: "transparent" }}
    >
      <Background
        variant={BackgroundVariant.Lines}
        gap={32}
        size={1}
        color="hsl(var(--border) / 0.1)"
      />
      <Controls
        showInteractive={false}
        className="!bg-muted/40 !border-border/40 !shadow-none [&>button]:!bg-transparent [&>button]:!border-border/30"
      />
    </ReactFlow>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function ChainBreadcrumb({ chain }: { chain: string[] }) {
  if (chain.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5 flex-wrap min-w-0">
      {chain.map((path, i) => (
        <span key={path} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 flex-shrink-0" />}
          <span
            className={cn(
              "text-[10px] truncate max-w-[90px]",
              i === chain.length - 1
                ? "text-foreground/80 font-medium"
                : "text-muted-foreground/60",
            )}
            title={path}
          >
            {path.split("/").pop()}
          </span>
        </span>
      ))}
    </div>
  );
}

// ── Test case row ─────────────────────────────────────────────────────────────

function TestCaseRow({ test }: { test: WorkspacePlaywrightTest }) {
  const [expanded, setExpanded] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [editedCode, setEditedCode] = useState(() => formatTestToSpec(test));
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden bg-muted/5">
      {/* Test header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
        )}
        <FlaskConical className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
        <span className="flex-1 text-xs font-medium text-foreground/90 truncate">{test.name}</span>
        <span
          className={cn(
            "text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0",
            SEVERITY_STYLE[test.severity] ?? "bg-muted/30 text-muted-foreground border-border/30",
          )}
        >
          {test.severity}
        </span>
        <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
          {test.steps.length} steps
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border/20 px-3 py-2 space-y-2">
          {/* Description */}
          {test.description && (
            <p className="text-[11px] text-muted-foreground/70 italic">{test.description}</p>
          )}

          {/* Steps list */}
          {!showCode && (
            <ol className="space-y-1">
              {test.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[9px] text-muted-foreground/40 pt-0.5 w-4 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono text-primary/70 mr-1.5">{step.action}</span>
                    <span className="text-[10px] text-muted-foreground/60">{step.description}</span>
                    {step.selector && (
                      <div className="text-[9px] font-mono text-muted-foreground/40 truncate">
                        {step.selector}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Code view / editor */}
          {showCode && (
            <div className="relative">
              <textarea
                className="w-full h-48 text-[10px] font-mono bg-muted/30 border border-border/30 rounded p-2 text-foreground/80 resize-y focus:outline-none focus:ring-1 focus:ring-primary/40"
                value={editedCode}
                onChange={(e) => setEditedCode(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              className={cn(
                "flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors",
                showCode
                  ? "border-primary/40 text-primary bg-primary/10"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border",
              )}
              onClick={() => setShowCode((v) => !v)}
            >
              <Code2 className="h-3 w-3" />
              {showCode ? "Hide Code" : "View Code"}
            </button>
            {showCode && (
              <button
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── File test group ───────────────────────────────────────────────────────────

function FileTestGroup({ group, chainIndex }: { group: FileTestGroup; chainIndex: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const fileName = group.filePath.split("/").pop() ?? group.filePath;

  return (
    <div className="space-y-1.5">
      {/* File header */}
      <button
        className="w-full flex items-center gap-2 px-1 py-0.5 rounded hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
        )}
        <span className="text-[9px] text-muted-foreground/50 font-mono w-4 text-right flex-shrink-0">
          {chainIndex + 1}
        </span>
        <FileCode className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
        <span className="font-mono text-xs font-semibold text-foreground/80 flex-1 text-left">
          {fileName}
        </span>
        <span className="text-[9px] text-muted-foreground/50 flex-shrink-0 bg-muted/40 px-1.5 py-0.5 rounded">
          {group.tests.length} test{group.tests.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Tests */}
      {!collapsed && (
        <div className="pl-6 space-y-1.5">
          {group.tests.map((test) => (
            <TestCaseRow key={test.id} test={test} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TreeFlowView ──────────────────────────────────────────────────────────────

export function TreeFlowView({
  onBackToCode,
  onTestsGenerated,
}: {
  onBackToCode?: () => void;
  onTestsGenerated?: (tests: WorkspacePlaywrightTest[]) => void;
} = {}) {
  const { workspace } = useWorkspaceContext();
  const { activeTab } = useWorkspaceContext();
  const impactQuery = useCommitImpactTree(workspace?.workspace_id ?? null, 5);
  const fallbackGraphQuery = useQuery({
    queryKey: ["tree-flow-fallback-graph", workspace?.workspace_id],
    queryFn: () =>
      impactApi.buildWorkspaceGraph({
        workspace_id: workspace!.workspace_id,
      }),
    enabled: !!workspace?.workspace_id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [generatingTests, setGeneratingTests] = useState(false);
  const [generatingFile, setGeneratingFile] = useState<string | null>(null);
  const [fileTests, setFileTests] = useState<FileTestGroup[] | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [requestedTestCount, setRequestedTestCount] = useState(3);

  const roots = impactQuery.data?.roots ?? [];
  const impactNodeMap = useMemo(() => flattenImpactTree(roots), [roots]);

  const impactChain = useMemo(() => {
    if (!activeTab) return [];
    return findPathToTarget(roots, activeTab) ?? [];
  }, [roots, activeTab]);

  const fallbackChain = useMemo(() => {
    if (!activeTab || !fallbackGraphQuery.data) return [];
    return deriveRootToLeafChain(
      activeTab,
      fallbackGraphQuery.data.nodes,
      fallbackGraphQuery.data.edges,
    );
  }, [activeTab, fallbackGraphQuery.data]);

  const chain = useMemo(() => {
    // Only use impactChain when it's a real path (2+ nodes).
    // A single-node impactChain means the selected file IS the changed root —
    // in that case the fallbackChain (full dependency walk) gives a richer view.
    if (impactChain.length > 1) return impactChain;
    if (fallbackChain.length > 0) return fallbackChain;
    if (impactChain.length > 0) return impactChain;
    return activeTab ? [activeTab] : [];
  }, [impactChain, fallbackChain, activeTab]);

  // Clear tests when chain changes
  useEffect(() => {
    setFileTests(null);
  }, [activeTab]);

  const handleGenerateTests = useCallback(async (testCount: number) => {
    if (!workspace || chain.length === 0) return;
    setGeneratingTests(true);
    setFileTests(null);

    const results: FileTestGroup[] = [];

    try {
      for (const filePath of chain) {
        setGeneratingFile(filePath.split("/").pop() ?? filePath);
        try {
          const file = await api.getWorkspaceFile(workspace.workspace_id, filePath);
          const result = await api.generatePlaywrightTests({
            workspace_id: workspace.workspace_id,
            file_path: filePath,
            content: file.content,
            num_tests: testCount,
          });
          if (result.tests.length > 0) {
            results.push({ filePath, tests: result.tests });
          }
        } catch {
          // Skip files that fail — non-blocking
        }
      }

      if (results.length === 0) {
        toast.error("No test cases could be generated for this chain.");
      } else {
        setFileTests(results);
        const allTests = results.flatMap((g) => g.tests);
        onTestsGenerated?.(allTests);
        toast.success(`Generated tests for ${results.length} file${results.length !== 1 ? "s" : ""}`);
      }
    } catch {
      toast.error("Failed to generate test cases. Please try again.");
    } finally {
      setGeneratingTests(false);
      setGeneratingFile(null);
    }
  }, [workspace, chain]);

  const normalizedRequestedTestCount = Math.min(10, Math.max(1, requestedTestCount || 1));

  const handleConfirmGenerate = useCallback(async () => {
    const testCount = Math.min(10, Math.max(1, requestedTestCount || 1));
    setRequestedTestCount(testCount);
    setShowGenerateDialog(false);
    await handleGenerateTests(testCount);
  }, [requestedTestCount, handleGenerateTests]);

  if (!workspace) return null;

  if (impactQuery.isLoading || fallbackGraphQuery.isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/5">
        <GitBranch className="h-8 w-8 opacity-20 animate-pulse" />
        <p className="text-xs">Building impact chain…</p>
      </div>
    );
  }

  if (!activeTab) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/5">
        <GitBranch className="h-10 w-10 opacity-15" />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground/50">No file selected</p>
          <p className="text-xs opacity-50">Click a file in the tree on the left</p>
        </div>
      </div>
    );
  }

  const isNotInTree = !!activeTab && !impactNodeMap.has(activeTab) && fallbackChain.length === 0;
  const hasTests = fileTests !== null && fileTests.length > 0;
  const totalTests = fileTests?.reduce((acc, g) => acc + g.tests.length, 0) ?? 0;

  return (
    <div className="h-full flex flex-col min-h-0 bg-background">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-2">
          {onBackToCode && (
            <button
              className="h-6 px-2 rounded border border-border/40 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 flex items-center gap-1 flex-shrink-0"
              onClick={onBackToCode}
              title="Back to code view"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </button>
          )}
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground/80 flex-shrink-0">
              Root → Leaf
            </span>
            {chain.length > 0 && (
              <span className="text-[10px] text-muted-foreground/50 bg-muted/40 px-1.5 py-0.5 rounded flex-shrink-0">
                {chain.length} node{chain.length !== 1 ? "s" : ""}
              </span>
            )}
            <ChainBreadcrumb chain={chain} />
          </div>

          {/* Generate button */}
          {chain.length > 0 && !isNotInTree && (
            <button
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-medium flex-shrink-0 transition-all",
                generatingTests
                  ? "bg-primary/20 text-primary/70 border border-primary/30 cursor-wait"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
              )}
              onClick={() => setShowGenerateDialog(true)}
              disabled={generatingTests}
            >
              {generatingTests ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {generatingFile ? `Generating ${generatingFile}…` : "Generating…"}
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  Generate Test Cases
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Flow canvas ── */}
      <div className={cn("min-h-0 transition-all duration-300", hasTests || generatingTests ? "flex-[2]" : "flex-1")}>
        {chain.length === 0 || isNotInTree ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/50 p-8">
            <Code2 className="h-8 w-8 opacity-20" />
            <p className="text-xs text-center">
              {isNotInTree
                ? "This file is not part of any changed-root dependency chain."
                : "No impact chain found."}
            </p>
            <p className="text-[10px] text-center opacity-70">
              No dependency path found for the selected file in this workspace graph.
            </p>
          </div>
        ) : (
          <FlowCanvas
            focusPath={activeTab}
            chain={chain}
            graphNodes={fallbackGraphQuery.data?.nodes ?? []}
            graphEdges={fallbackGraphQuery.data?.edges ?? []}
            impactNodeMap={impactNodeMap}
          />
        )}
      </div>

      {/* ── Generated Tests panel ── */}
      {(hasTests || generatingTests) && (
        <div className="flex-[3] border-t border-border/40 flex flex-col min-h-0 bg-background">
          {/* Panel header */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-border/30 bg-muted/10 flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5 text-primary/70" />
            <span className="text-xs font-semibold text-foreground/80">Generated Test Cases</span>
            {hasTests && (
              <span className="text-[10px] text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded">
                {totalTests} test{totalTests !== 1 ? "s" : ""} across {fileTests!.length} file{fileTests!.length !== 1 ? "s" : ""}
              </span>
            )}
            {hasTests && (
              <button
                className="ml-auto h-5 w-5 flex items-center justify-center rounded hover:bg-muted/60"
                onClick={() => setFileTests(null)}
                title="Close tests panel"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Loading state */}
          {generatingTests && !hasTests && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
                <span className="text-sm">
                  {generatingFile ? `Analysing ${generatingFile}…` : "Generating test cases…"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/50 text-center max-w-xs">
                Generating Playwright test cases for each file in the root-to-leaf chain
              </p>
            </div>
          )}

          {/* Tests content */}
          {hasTests && (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {fileTests!.map((group, i) => (
                <FileTestGroup key={group.filePath} group={group} chainIndex={i} />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Generate Test Cases</DialogTitle>
            <DialogDescription>
              Choose how many Playwright test cases to generate per file in this chain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-foreground/90">Number of tests</p>
                <p className="text-[11px] text-muted-foreground">Allowed range: 1 to 10</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRequestedTestCount((v) => Math.max(1, v - 1))}
                  className="h-7 w-7 rounded border border-border/60 bg-muted/40 text-sm font-bold text-foreground hover:bg-muted"
                >
                  -
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">
                  {normalizedRequestedTestCount}
                </span>
                <button
                  type="button"
                  onClick={() => setRequestedTestCount((v) => Math.min(10, v + 1))}
                  className="h-7 w-7 rounded border border-border/60 bg-muted/40 text-sm font-bold text-foreground hover:bg-muted"
                >
                  +
                </button>
              </div>
            </div>

            <Input
              type="number"
              min={1}
              max={10}
              value={normalizedRequestedTestCount}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) {
                  setRequestedTestCount(1);
                  return;
                }
                setRequestedTestCount(Math.min(10, Math.max(1, Math.trunc(value))));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleConfirmGenerate();
                }
              }}
            />
          </div>

          <DialogFooter>
            <button
              type="button"
              className="h-9 px-3 rounded-md border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
              onClick={() => setShowGenerateDialog(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              onClick={() => void handleConfirmGenerate()}
            >
              Generate
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
