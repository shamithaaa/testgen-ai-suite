# View in Tree + Gephi Graph Logic

This document explains **what is shown** in the Tree/Gephi view and **how the logic works end-to-end** in `testgen-ai-suite`.

## 1) Entry point: where "View in Tree" comes from

Main wiring is in `src/pages/Workspace.tsx`.

- The center panel has two modes:
  - `code` -> shows `EditorArea`
  - `tree` -> shows `TreeFlowView`
- Clicking **"View in Tree"** sets:
  - `treeRefreshNonce` increment (forces refetch in left tree)
  - `centerMode = "tree"`
- In tree mode, center renders:
  - `TreeFlowView` (which hosts Gephi/Flow visual graph)
- Left panel is always visible:
  - `ViewEntryTree` (file tree + changed/entry indicators)

## 2) Data sources used for the visual graph

`TreeFlowView` (`src/components/workspace/TreeFlowView.tsx`) combines two backend data sources:

1. **Commit impact tree** (changed-root chain metadata)
   - Hook: `useCommitImpactTree(workspaceId, maxDepth, githubPat?)`
   - API: `api.getCommitImpactTree(...)`
   - Returns `roots: CommitImpactTreeNode[]` (hierarchical dependency-impact tree)

2. **Workspace dependency graph** (full graph for rendering)
   - Query key: `tree-flow-fallback-graph`
   - API: `impactApi.buildWorkspaceGraph({ workspace_id, pat })`
   - Returns:
     - `nodes: GraphNode[]`
     - `edges: GraphEdge[]`

Supporting types are in `src/lib/api.ts`:
- `GraphNode`: `path`, `is_changed`, `layer`, `x`, `y`, etc.
- `GraphEdge`: `source`, `target`

## 3) Chain selection logic (what path is used)

`TreeFlowView` computes three chain candidates:

1. `impactChain`
   - From `roots` tree via `findPathToTarget(roots, activeTab)`
   - This is the direct changed-root -> selected-file path from impact tree

2. `fallbackChain`
   - From raw graph via `deriveRootToLeafChain(activeTab, nodes, edges)`
   - Used when impact tree is too narrow or selected file is root itself

3. final `chain`
   - Selection rule:
     - if `impactChain.length > 1` -> use impact chain
     - else if `fallbackChain.length > 0` -> use fallback chain
     - else if impact has 1 node -> use it
     - else fallback to `[activeTab]`

Why: a single-node impact chain often means "selected file is itself a changed root", so fallback graph traversal gives richer context.

## 4) What the user sees in graph mode

`flowViewMode` defaults to `"gephi"`:

- In the header, only Gephi tab is active in current UI (Flow/Chain buttons are commented out)
- Center canvas renders:
  - `<GephiSigmaGraph focusPath={activeTab} nodes={workspaceGraph.nodes} edges={workspaceGraph.edges} changedPaths={changedPathSet} />`

`changedPathSet` is built as union of:
- all graph nodes where `node.is_changed === true`
- all node paths present in `impactNodeMap` (flattened impact tree)

So files are treated as changed if they appear in either graph changed markers or impact-tree membership.

## 5) Gephi graph build pipeline

Core builder: `buildGraphologyGraph(nodes, edges, changedPaths)` in `src/components/workspace/GephiSigmaGraph.tsx`.

### 5.1 Path normalization + edge matching

The backend can return edges in slightly different naming forms. Builder handles this by:

- normalizing paths:
  - slash normalization
  - remove leading `./`
  - strip known extensions (`py`, `ts`, `tsx`, `js`, `jsx`, `css`, `scss`, `json`)
  - convert `/` to `.`
- creating a `pathMap` with:
  - full normalized path -> original node path
  - suffix mappings for partial references (e.g. `auth.route`)
  - special mapping for `__init__.py` to directory module name
- resolving each edge endpoint (`source`, `target`) through `getOriginalPath(...)`
- retaining only valid, non-self edges where both ends exist in node set

### 5.2 Degree and node size calculation

For each matched edge:
- increment `outDegree[source]`
- increment `inDegree[target]`

For each node:
- `degree = inDegree + outDegree`
- importance score:
  - `importance = inDegree * 2.8 + outDegree * 1.5`
- size:
  - `size = 7 + sqrt(importance) * 5`
  - clamped to `[7, 50]`

Interpretation: inbound-heavy files are emphasized more than outbound-heavy files.

### 5.3 Initial position + color

Each node starts from deterministic hash-based radial position:
- same path -> same initial `(x, y)` (stable across runs)

Base color logic:
- changed node (`changedPaths` or `node.is_changed`) -> orange `#f97316`
- otherwise -> module color hash (`colorForModule(path)`)

### 5.4 Community clustering + force layout

If graph has nodes:
- run Louvain community detection
- recolor non-changed nodes by community palette
- run ForceAtlas2 with tuned settings:
  - gravity, scaling ratio, linLog mode, adjust sizes, strong gravity, etc.
- finally re-center and normalize coordinates into a bounded span

Result: clustered but bounded graph that fits camera well.

## 6) Runtime interaction logic in Sigma

`GraphInteractionLayer` applies all interactive behavior.

### 6.1 Camera behavior

- On graph load: load graph into Sigma and center camera
- On manual reset (`cameraResetCount` increment): animate to full graph view
- On node selection: animate camera to selected node (`ratio: 0.55`)

### 6.2 Focus model

Active focus node priority:
1. currently hovered node
2. selected node
3. `focusPath` (active editor file)

Neighborhood set is built from graph neighbors of active focus.

### 6.3 Node filtering/reduction (`nodeReducer`)

Reducer applies, in order:

1. **Insight mode pruning**
   - hide low-signal leaves:
   - `inDegree === 0 && outDegree <= 1`
   - except if changed/focus/selected

2. **Extension filter**
   - only show selected extensions from toolbar buttons

3. **Search filter**
   - if search text does not match `label` or `path`, dim heavily and remove label

4. **Isolate focus mode**
   - when enabled, nodes outside focus neighborhood are dimmed/hidden-style

5. **Focus styling**
   - currently edited file (`focusPath`) forced sky-blue `#0ea5e9`
   - focus node gets high `zIndex` and enlarged size
   - labels forced on focused/edited nodes for readability

### 6.4 Edge filtering/reduction (`edgeReducer`)

Reducer applies:

1. hide if either endpoint extension is filtered out
2. in insight mode, hide edges connected to pruned low-signal nodes
3. with active focus:
   - isolate mode: hide non-connected edges
   - non-isolate mode: de-emphasize non-connected edges
4. for connected edges, direction-aware highlighting:
   - **Outbound from focus** (`source === activeFocus`) -> orange `#f97316`
   - **Inbound to focus** (`target === activeFocus`) -> cyan `#0ea5e9`

This gives immediate "what I use vs who uses me" visual semantics.

## 7) Gephi UI controls and what they affect

In `GephiSigmaGraph` header:

- Search box:
  - text match on node label/path
- Insight View toggle:
  - enables low-signal pruning
- Isolated toggle:
  - keeps only focus neighborhood emphasized
- Extension chips (e.g. `.ts`, `.tsx`):
  - filter nodes/edges by file extension
- Expand/Collapse button:
  - fullscreen-like fixed overlay mode
  - increments `cameraResetCount` to reframe graph

Hover shows rich tooltip with:
- filename/path
- inbound/outbound degree counts
- "Modified File" badge if changed

Selection panel appears bottom-left with currently selected node and clear action.

## 8) Relation to non-Gephi flow code

`TreeFlowView` also contains React Flow builders:
- `buildBranchFlow(...)` (strict chain layout)
- `buildNeighborhoodFlow(...)` (2-hop focus neighborhood)
- rendered via `FlowCanvas`

Currently UI defaults to and exposes Gephi mode; Flow/Chain mode buttons are commented out in header, but logic remains implemented.

## 9) Left-side "View Entry" tree relation

`ViewEntryTree` (`src/components/workspace/ViewEntryTree.tsx`) drives file selection context:

- fetches workspace file tree + impact roots + git status
- marks entry roots (flame icon) from impact roots
- marks file status (`M/U/A`) from git status maps
- clicking file opens it in editor (`openFile(...)`) and sets active tab

That `activeTab` is what `TreeFlowView` uses as `focusPath`, so tree selection directly controls Gephi focus and chain derivation.

## 10) End-to-end execution summary

1. User clicks **View in Tree** in workspace toolbar.
2. Center switches to `TreeFlowView`.
3. `TreeFlowView` fetches:
   - commit impact roots
   - full workspace dependency graph
4. It computes:
   - active chain (`impactChain` / `fallbackChain`)
   - changed file set (`changedPathSet`)
5. In Gephi mode, graph is built with:
   - path reconciliation
   - degree/importance sizing
   - changed-node highlighting
   - Louvain + ForceAtlas2 layout
6. Sigma reducers apply live filters:
   - insight mode, extension filters, search, isolate focus
   - directional edge coloring around focus
7. Result is an interactive dependency map centered on selected/hovered/current file context.

