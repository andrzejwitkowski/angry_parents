import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

interface SidebarHeaderProps {
    user: User | null;
    isCollapsed: boolean;
    onToggle: () => void;
}

export function SidebarHeader({ user, isCollapsed, onToggle }: SidebarHeaderProps) {
    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="absolute -right-4 top-10 h-8 w-8 rounded-full bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white z-50"
            >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>

            <div className="flex flex-col items-center py-8 px-4 overflow-hidden">
                <Avatar className={cn("transition-all duration-300", isCollapsed ? "h-10 w-10" : "h-20 w-20 mb-4")}>
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`} />
                    <AvatarFallback className="bg-slate-700 text-slate-200 uppercase">
                        {user?.name?.substring(0, 2) || "AP"}
                    </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                    <div className="text-center animate-in fade-in slide-in-from-top-2 duration-300">
                        <h2 className="font-bold text-lg truncate w-48">{user?.name}</h2>
                        <p className="text-slate-400 text-xs truncate w-48">@{user?.username}</p>
                    </div>
                )}
            </div>
        </>
    );
}
