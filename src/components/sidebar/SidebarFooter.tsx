import { LogOut } from "lucide-react";
import { SidebarNavItem } from "./SidebarNavItem";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authApi } from "@/lib/api/auth";
import { useTranslation } from "react-i18next";
import { SecurityTimer } from "../security/SecurityTimer";
import { clearActivePrivateKey } from "@/lib/e2ee-session";
import { useSecurity } from "@/context/SecurityContext";

interface SidebarFooterProps {
    isCollapsed: boolean;
}

export function SidebarFooter({ isCollapsed }: SidebarFooterProps) {
    const { t } = useTranslation();
    const { clearCurrentUserId, lockForLogout } = useSecurity();

    const handleLogout = async () => {
        lockForLogout();
        await clearActivePrivateKey().catch((error) => {
            console.error("Failed to clear local E2EE session during logout", error);
        });
        await authApi.logout();
        clearCurrentUserId();
        window.location.assign("/auth");
    };

    return (
        <div className="p-4 border-t border-slate-800">
            <div className="mb-4">
                <SecurityTimer isCollapsed={isCollapsed} />
            </div>
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
