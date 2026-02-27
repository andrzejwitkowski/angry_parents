import { LogOut } from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authApi } from "@/lib/api/auth";
import { useTranslation } from "react-i18next";

interface SidebarFooterProps {
    isCollapsed: boolean;
}

export function SidebarFooter({ isCollapsed }: SidebarFooterProps) {
    const { t } = useTranslation();

    const handleLogout = async () => {
        await authApi.logout();
        window.location.href = "/auth";
    };

    return (
        <div className="p-4 border-t border-slate-800">
            <TooltipProvider delayDuration={0}>
                <SidebarNavItem
                    icon={LogOut}
                    label={t('sidebar.logout')}
                    isCollapsed={isCollapsed}
                    onClick={handleLogout}
                    variant="destructive"
                />
            </TooltipProvider>
        </div>
    );
}
