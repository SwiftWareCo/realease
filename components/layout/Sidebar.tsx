"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    CalendarDays,
    Building2,
    Home,
    Users,
    TrendingUp,
    PhoneCall,
} from "lucide-react";
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
    SidebarRail,
} from "@/components/ui/sidebar";

type NavItem = {
    name: string;
    href: string;
    icon: React.ElementType;
};

const navigation: NavItem[] = [
    {
        name: "Homepage",
        href: "/",
        icon: Home,
    },
    {
        name: "Leads",
        href: "/leads",
        icon: Users,
    },
    {
        name: "Outreach",
        href: "/leads/outreach",
        icon: PhoneCall,
    },
    {
        name: "Insights",
        href: "/insights",
        icon: TrendingUp,
    },
    {
        name: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
    },
    {
        name: "Listings",
        href: "/listings",
        icon: Building2,
    },
];

function isRouteActive(pathname: string, href: string): boolean {
    if (href === "/") {
        return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
    const pathname = usePathname();

    return (
        <ShadcnSidebar collapsible="icon">
            <SidebarHeader className="border-b border-sidebar-border">
                <div className="flex h-14 items-center px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                    <Image
                        src="/logo.png"
                        alt="RealEase"
                        width={180}
                        height={51}
                        priority
                        className="h-auto w-[132px] transition-opacity duration-200 group-data-[collapsible=icon]:hidden"
                    />
                    <div className="hidden items-center justify-center group-data-[collapsible=icon]:flex">
                        <Image
                            src="/logo-mark.svg"
                            alt="RealEase Mark"
                            width={32}
                            height={32}
                            priority
                            className="h-8 w-8"
                        />
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navigation.map((item) => (
                                <SidebarMenuItem key={item.name}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isRouteActive(
                                            pathname,
                                            item.href,
                                        )}
                                        tooltip={item.name}
                                    >
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarRail />
        </ShadcnSidebar>
    );
}
