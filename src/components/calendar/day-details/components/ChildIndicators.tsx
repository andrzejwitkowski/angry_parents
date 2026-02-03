import { useChildren } from "@/hooks/useChildren";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChildIndicatorsProps {
    childIds: string[];
}

export function ChildIndicators({ childIds = [] }: ChildIndicatorsProps) {
    const { getChildrenByIds } = useChildren();
    const linkedChildren = getChildrenByIds(childIds || []);

    if (!linkedChildren || linkedChildren.length === 0) return null;

    return (
        <TooltipProvider>
            <div className="flex -space-x-2 overflow-hidden py-1">
                {linkedChildren.map((child) => (
                    <Tooltip key={child.id}>
                        <TooltipTrigger asChild>
                            <div
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold shadow-sm cursor-help ring-1 ring-slate-200"
                                style={{ backgroundColor: child.color, color: 'white', textShadow: '0px 1px 2px rgba(0,0,0,0.2)' }}
                            >
                                {child.name.charAt(0).toUpperCase()}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>{child.name}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </TooltipProvider>
    );
}
