import { Calendar, Settings } from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";

interface SidebarNavProps {
    isCollapsed: boolean;
}

export function SidebarNav({ isCollapsed }: SidebarNavProps) {
    const navigate = useNavigate();

    const navItems = [
        { icon: Calendar, label: "Calendar", path: "/dashboard" },
        { icon: Settings, label: "Settings", path: "/settings" },
    ];

    return (
        <nav className="flex-1 px-3 space-y-2 mt-4">
            <TooltipProvider delayDuration={0}>
                {navItems.map((item) => (
                    <SidebarNavItem
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        isCollapsed={isCollapsed}
                        onClick={() => navigate(item.path)}
                    />
                ))}
            </TooltipProvider>
        </nav>
    );
}
