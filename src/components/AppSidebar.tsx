import { Home, Users, FileText, Printer, Tag, Layout, History, UserCog } from "lucide-react";
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

export function AppSidebar() {
  const { isAdmin } = useIsAdmin();

  return (
    <Sidebar>
      <SidebarContent>
        <div className="px-6 py-4">
          <h2 className="text-xl font-bold text-sidebar-foreground">
            Layout Manager
          </h2>
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
                      to="/usuarios"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : ""
                      }
                    >
                      <UserCog className="h-4 w-4" />
                      <span>Usuários</span>
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
