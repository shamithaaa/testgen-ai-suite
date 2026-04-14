import {
  LayoutDashboard,
  FileText,
  TestTubes,
  Database,
  Play,
  ArrowUpDown,
  Clapperboard,
  GitPullRequest,
  Activity,
  Bug,
  Lock,
  BarChart3,
  AlertOctagon,
  Gauge,
  Brain,
  Code2,
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

const workflowSteps = [
  { step: 1, title: "Requirements", url: "/requirements", icon: FileText, hint: "Submit & analyze requirements" },
  { step: 2, title: "Test Suite", url: "/generated-tests", icon: TestTubes, hint: "Review AI-generated test cases" },
  { step: 3, title: "Test Execution", url: "/test-execution", icon: Play, hint: "Execute & analyze results" },
  { step: 4, title: "Risk Ranking", url: "/prioritization", icon: ArrowUpDown, hint: "Prioritized by risk & severity" },
];

const toolItems = [
  { title: "Synthetic Data", url: "/synthetic-data", icon: Database, hint: "AI-generated test datasets" },
  { title: "Live Test Runner", url: "/live-testing", icon: Clapperboard, hint: "Repository → AI → Browser execution" },
  { title: "AI Workspace", url: "/workspace", icon: Code2, hint: "Code editor + AI Copilot + Git" },
];

const sdlcItems = [
  { title: "Requirements Intel", url: "/requirements-intelligence", icon: Brain, hint: "Jira stories + BDD generation" },
  { title: "Code Review", url: "/code-review", icon: GitPullRequest, hint: "AI inline PR review" },
  // { title: "CI/CD Intelligence", url: "/ci-intelligence", icon: Activity, hint: "Build health & flaky test detection" },
  { title: "Defect Prediction", url: "/defect-prediction", icon: Bug, hint: "File risk scoring from git history" },
  { title: "Release Gate", url: "/release-gate", icon: Lock, hint: "Go/no-go release decision" },
  { title: "Monitoring", url: "/monitoring", icon: Gauge, hint: "Anomaly detection & predictive alerts" },
  // { title: "Incidents", url: "/incidents", icon: AlertOctagon, hint: "Root cause AI investigation" },
  // { title: "Sprint Intelligence", url: "/sprint-intelligence", icon: BarChart3, hint: "DORA metrics & sprint summary" },
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

        {/* Test Generation Workflow */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Test Generation
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {workflowSteps.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={`Step ${item.step}: ${item.title}`}
                    size={collapsed ? "default" : "lg"}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="transition-colors"
                      activeClassName="bg-primary/10 text-primary"
                    >
                      <div className="relative h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-4 w-4" />
                        <span className={`absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full text-[8px] font-bold flex items-center justify-center ${isActive(item.url) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {item.step}
                        </span>
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

        {/* Tools */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Tools
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
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

        {/* SDLC Intelligence */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              SDLC Intelligence
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {sdlcItems.map((item) => (
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
