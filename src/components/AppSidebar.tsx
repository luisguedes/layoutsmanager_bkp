import { Home, Users, FileText, Printer, Tag, Layout, History, Settings, Building2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Modelos", url: "/modelos", icon: FileText },
  { title: "Tipos de Impressão", url: "/tipos", icon: Printer },
  { title: "Campos", url: "/campos", icon: Tag },
  { title: "Layouts", url: "/layouts", icon: Layout },
  { title: "Histórico", url: "/historico", icon: History },
];

interface AppSidebarProps {
  companyLogo?: string;
  companyName?: string;
}

export function AppSidebar({ companyLogo, companyName }: AppSidebarProps) {
  const { isAdmin } = useIsAdmin();

  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-6 py-4">
          {companyLogo ? (
            <div className="flex items-center gap-3">
              <img 
                src={companyLogo} 
                alt={companyName || "Logo"} 
                className="h-10 w-10 object-contain rounded"
              />
              <h2 className="text-lg font-bold text-sidebar-foreground truncate">
                {companyName || "Layout Manager"}
              </h2>
            </div>
          ) : (
            <h2 className="text-xl font-bold text-sidebar-foreground">
              {companyName || "Layout Manager"}
            </h2>
          )}
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : ""
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/configuracoes"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : ""
                      }
                    >
                      <Settings className="h-4 w-4" />
                      <span>Configurações</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
