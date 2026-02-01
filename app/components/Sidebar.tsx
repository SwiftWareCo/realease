'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, TrendingUp } from 'lucide-react';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Insights',
    href: '#',
    icon: TrendingUp,
    items: [
      { name: 'Market Intelligence', href: '/insights/market-intelligence' },
      { name: 'My Business', href: '/insights/my-business' },
      { name: 'Automations', href: '/insights/automations' },
      { name: 'AI Suggestions', href: '/insights/ai-suggestions' },
    ],
  },
  {
    name: 'Lead Forms',
    href: '/lead-forms',
    icon: FileText,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <ShadcnSidebar>
      <SidebarHeader>
        <div className="flex h-16 items-center px-6">
          <h2 className="text-lg font-semibold text-sidebar-foreground">
            Realty
          </h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                if (item.items) {
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.name}
                        className="font-medium"
                      >
                        <div className="flex items-center">
                          <item.icon />
                          <span>{item.name}</span>
                        </div>
                      </SidebarMenuButton>
                      <ul className="ml-4 mt-1 flex flex-col gap-1 border-l border-sidebar-border/50 px-2 py-0.5">
                        {item.items.map((subItem) => {
                          const isSubActive = pathname === subItem.href;
                          return (
                            <SidebarMenuItem key={subItem.name}>
                              <SidebarMenuButton
                                asChild
                                isActive={isSubActive}
                                size="sm"
                                className="h-7 text-sm"
                              >
                                <Link href={subItem.href}>
                                  <span>{subItem.name}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </ul>
                    </SidebarMenuItem>
                  );
                }

                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </ShadcnSidebar>
  );
}
