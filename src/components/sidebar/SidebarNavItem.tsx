import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import React from "react";

interface SidebarNavItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    isCollapsed: boolean;
    onClick: () => void;
    variant?: "ghost" | "destructive";
}

export function SidebarNavItem({
    icon: Icon,
    label,
    isCollapsed,
    onClick,
    variant = "ghost"
}: SidebarNavItemProps) {
    const isDestructive = variant === "destructive";

    return (
        <Tooltip disableHoverableContent={!isCollapsed}>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start transition-colors",
                        isCollapsed ? "px-2" : "px-4",
                        isDestructive
                            ? "text-slate-400 hover:text-red-400 hover:bg-red-400/5"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    )}
                    onClick={onClick}
                >
                    <Icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                    {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
                </Button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">{label}</TooltipContent>}
        </Tooltip>
    );
}
