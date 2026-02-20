import { Calendar, Settings } from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface SidebarNavProps {
    isCollapsed: boolean;
}

export function SidebarNav({ isCollapsed }: SidebarNavProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const navItems = [
        { icon: Calendar, label: t('sidebar.calendar'), path: "/dashboard" },
        { icon: Settings, label: t('sidebar.settings'), path: "/settings" },
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
