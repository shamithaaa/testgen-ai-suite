import {
  LayoutDashboard,
  FileText,
  TestTubes,
  Database,
  Play,
  ArrowUpDown,
  Clapperboard,
  GitPullRequest,
  Bug,
  Lock,
  Gauge,
  Code2,
  Workflow,
  Network,
  BookOpen,
  Rocket,
  ClipboardList,
  Wand2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const pipelineItem = { title: "SDLC Pipeline", url: "/pipeline", icon: Workflow, hint: "Workspace → Commit → Review → Tests → Report" };

const sdlcTools = [
  { title: "AI App Builder", url: "/ai-ide", icon: Wand2, hint: "Type an idea → AI generates a full React app live" },
  { title: "AI Workspace", url: "/workspace", icon: Code2, hint: "Code editor + AI Copilot + Git" },
  { title: "Code Reviewer", url: "/code-review", icon: GitPullRequest, hint: "AI inline PR review" },
  { title: "Code Impact", url: "/code-impact", icon: Network, hint: "Root→Leaf dependency graph + test gen" },
  { title: "Deployments", url: "/deployments", icon: Rocket, hint: "Trigger + track Vercel deployments" },
  { title: "PRD Generator", url: "/prd", icon: ClipboardList, hint: "AI-generated Product Requirements Doc" },
  { title: "Doc-Driven Tests", url: "/doc-tests", icon: BookOpen, hint: "Upload docs → extract scenarios → run tests" },
  { title: "Live Test Runner", url: "/live-testing", icon: Clapperboard, hint: "Repository → AI → Browser execution" },
  { title: "Defect Prediction", url: "/defect-prediction", icon: Bug, hint: "File risk scoring from git history" },
  { title: "Release Gate", url: "/release-gate", icon: Lock, hint: "Go/no-go release decision" },
  { title: "Monitoring", url: "/monitoring", icon: Gauge, hint: "Anomaly detection & predictive alerts" },
];

const betaItems = [
  { title: "Requirements", url: "/requirements", icon: FileText, hint: "Beta · In Progress" },
  { title: "Test Suite", url: "/generated-tests", icon: TestTubes, hint: "Beta · In Progress" },
  { title: "Test Execution", url: "/test-execution", icon: Play, hint: "Beta · In Progress" },
  { title: "Risk Ranking", url: "/prioritization", icon: ArrowUpDown, hint: "Beta · In Progress" },
  { title: "Synthetic Data", url: "/synthetic-data", icon: Database, hint: "Beta · In Progress" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-background border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden p-1">
            <img
              src="/logo.png"
              alt="SDLC logo"
              className="h-full w-full object-contain scale-125"
            />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-display font-bold text-sm text-foreground">SDLC</h2>
              <p className="text-[10px] text-muted-foreground">AI-Powered SDLC Platform</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Overview */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Overview
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")} tooltip="Dashboard">
                  <NavLink to="/dashboard" end className="transition-colors" activeClassName="bg-primary/10 text-primary">
                    <div className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0">
                      <LayoutDashboard className="h-4 w-4" />
                    </div>
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Pipeline */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Pipeline
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive(pipelineItem.url)} tooltip={pipelineItem.title} size={collapsed ? "default" : "lg"}>
                  <NavLink to={pipelineItem.url} end className="transition-colors" activeClassName="bg-primary/10 text-primary">
                    <div className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0">
                      <pipelineItem.icon className="h-4 w-4" />
                    </div>
                    {!collapsed && (
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm leading-tight">{pipelineItem.title}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{pipelineItem.hint}</span>
                      </div>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SDLC Tools */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              SDLC Tools
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {sdlcTools.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    size={collapsed ? "default" : "lg"}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="transition-colors"
                      activeClassName="bg-primary/10 text-primary"
                    >
                      <div className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>
                      {!collapsed && (
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm leading-tight">{item.title}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{item.hint}</span>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Beta / In Progress */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/60">
              <span>Beta / In Progress</span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-amber-700 dark:text-amber-300">
                Coming soon
              </span>
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {betaItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    size={collapsed ? "default" : "lg"}
                  >
                    <NavLink to={item.url} end className="transition-colors" activeClassName="bg-primary/10 text-primary">
                      <div className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>
                      {!collapsed && (
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm leading-tight">{item.title}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{item.hint}</span>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
