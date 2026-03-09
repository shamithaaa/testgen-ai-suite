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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Requirements", url: "/requirements", icon: FileText },
  { title: "Generated Tests", url: "/generated-tests", icon: TestTubes },
  { title: "Synthetic Data", url: "/synthetic-data", icon: Database },
  { title: "Test Execution", url: "/test-execution", icon: Play },
  { title: "Prioritization", url: "/prioritization", icon: ArrowUpDown },
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end
                      className="transition-colors"
                      activeClassName="bg-primary/10 text-primary"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
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
