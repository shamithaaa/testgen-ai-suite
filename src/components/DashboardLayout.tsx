import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChevronDown, User } from "lucide-react";

const DashboardLayout = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="h-5 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-background border border-border/50 flex items-center justify-center overflow-hidden p-1">
                  <img src="/logo.png" alt="SDLC logo" className="h-full w-full object-contain scale-125" />
                </div>
                <span className="font-display font-semibold text-sm">SDLC</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/50">
                <span>My Workspace</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 flex items-center justify-center">
                <User className="h-4 w-4 text-foreground" />
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
