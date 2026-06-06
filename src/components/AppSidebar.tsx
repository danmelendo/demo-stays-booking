import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  Hotel,
  LogOut,
  PackagePlus,
  Tag,
  Users,
  BarChart3,
  Wand2,
  Globe,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRoles } from "@/lib/roles";

const items = [
  { to: "/today", label: "Hoy", icon: Calendar },
  { to: "/calendar", label: "Calendario", icon: CalendarDays },
  { to: "/reservations", label: "Reservas", icon: ClipboardList },
  { to: "/customers", label: "Clientes", icon: Users },
  { to: "/reports", label: "Informes", icon: BarChart3 },
] as const;

const adminItems = [
  { to: "/admin/manual", label: "Reserva manual", icon: Wand2 },
  { to: "/rooms", label: "Habitaciones", icon: DoorOpen },
  { to: "/rates", label: "Tarifas", icon: Tag },
  { to: "/extras", label: "Extras", icon: PackagePlus },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { signOut, user } = useAuth();
  const { isAdmin } = useRoles();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Hotel className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Demo Stays</span>
            <span className="text-xs text-muted-foreground">{isAdmin ? "Administrador" : "Recepción"}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operativa</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.to || path.startsWith(item.to + "/");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const active = path === item.to;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Web pública">
                    <a href="/reservar" target="_blank" rel="noreferrer" className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>Web pública</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 pb-1 flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate flex-1" title={user?.email ?? ""}>
            {user?.email}
          </span>
          {isAdmin && <Badge variant="outline" className="text-[10px]">admin</Badge>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
