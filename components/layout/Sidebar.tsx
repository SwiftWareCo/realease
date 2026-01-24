'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard,CalendarDays, Home, ChevronRight, BarChart3, Users } from 'lucide-react';
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string; icon?: React.ElementType }[];
};

const navigation: NavItem[] = [
  {
    name: 'Homepage',
    href: '/',
    icon: Home,
  },
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    children: [
      { name: 'Leads', href: '/dashboard/leads', icon: Users },
      { name: 'Insights', href: '/dashboard/insights', icon: BarChart3 },
    ],
  },
  {
    name: 'Calendar',
    href: '/calendar',
    icon: CalendarDays,
  },
  {
    name: 'Listings',
    href: '/listings',
    icon: Home,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <ShadcnSidebar>
      <SidebarHeader>
        <div className="flex h-14 items-center px-4">
          <Image
            src="/logo.png"
            alt="RealEase"
            width={180}
            height={51}
            priority
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const isChildActive = item.children?.some(child => pathname === child.href);

                // Items with children use Collapsible
                if (item.children && item.children.length > 0) {
                  return (
                    <Collapsible
                      key={item.name}
                      asChild
                      defaultOpen={isActive || isChildActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive || isChildActive}
                            tooltip={item.name}
                          >
                            <item.icon />
                            <span>{item.name}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map((child) => (
                              <SidebarMenuSubItem key={child.name}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === child.href}
                                >
                                  <Link href={child.href}>
                                    {child.icon && <child.icon />}
                                    <span>{child.name}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                // Regular items without children
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

