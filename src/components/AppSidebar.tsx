import {
  LayoutDashboard,
  FileText,
  TestTubes,
  Database,
  Play,
  ArrowUpDown,
  Zap,
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
  { step: 1, title: "Requirements", url: "/requirements", icon: FileText, hint: "Paste your requirement" },
  { step: 2, title: "Generated Tests", url: "/generated-tests", icon: TestTubes, hint: "Review AI test cases" },
  { step: 3, title: "Test Execution", url: "/test-execution", icon: Play, hint: "Run & see results" },
  { step: 4, title: "Prioritization", url: "/prioritization", icon: ArrowUpDown, hint: "AI-ranked by risk" },
];

const toolItems = [
  { title: "Synthetic Data", url: "/synthetic-data", icon: Database, hint: "Generate vehicle data" },
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
          <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-display font-bold text-sm text-foreground">TestGen AI</h2>
              <p className="text-[10px] text-muted-foreground">Intelligent Testing</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Overview */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3 pb-1">Overview</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")} tooltip="Dashboard">
                  <NavLink to="/dashboard" end className="transition-colors" activeClassName="bg-primary/10 text-primary">
                    <LayoutDashboard className="h-4 w-4" />
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Workflow steps */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3 pb-1">Workflow</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {workflowSteps.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={`Step ${item.step}: ${item.title}`}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="transition-colors"
                      activeClassName="bg-primary/10 text-primary"
                    >
                      <div className="relative flex-shrink-0">
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
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3 pb-1">Tools</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end className="transition-colors" activeClassName="bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" />
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
