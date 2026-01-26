import { useState } from "react";
import { cn } from "@/lib/utils";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { SidebarNav } from "./sidebar/SidebarNav";
import { SidebarFooter } from "./sidebar/SidebarFooter";

interface SidebarProps {
    user: any;
}

export function Sidebar({ user }: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div
            className={cn(
                "relative flex flex-col h-screen bg-slate-900 text-slate-100 transition-all duration-300 ease-in-out border-r border-slate-800",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            <SidebarHeader
                user={user}
                isCollapsed={isCollapsed}
                onToggle={() => setIsCollapsed(!isCollapsed)}
            />

            <SidebarNav isCollapsed={isCollapsed} />

            <SidebarFooter isCollapsed={isCollapsed} />
        </div>
    );
}
