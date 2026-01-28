import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TimelineItem } from "@/types/timeline.types";
import {
    Stethoscope,
    Pill,
    ArrowLeftRight,
    AlertTriangle,
    MessageSquare,
    Clock,
    ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface EventIndicatorProps {
    event: TimelineItem;
    onViewDetails?: () => void;
}

const ICON_MAP = {
    MEDICAL_VISIT: { icon: Stethoscope, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    MEDS: { icon: Pill, color: "text-blue-500 bg-blue-50 border-blue-100" },
    HANDOVER: { icon: ArrowLeftRight, color: "text-purple-500 bg-purple-50 border-purple-100" },
    INCIDENT: { icon: AlertTriangle, color: "text-red-500 bg-red-50 border-red-100" },
    NOTE: { icon: MessageSquare, color: "text-gray-400 bg-gray-50 border-gray-100" },
    VACATION: { icon: MessageSquare, color: "text-orange-400 bg-orange-50 border-orange-100" },
    ATTACHMENT: { icon: MessageSquare, color: "text-slate-400 bg-slate-50 border-slate-100" },
};

export function EventIndicator({ event, onViewDetails }: EventIndicatorProps) {
    const config = ICON_MAP[event.type as keyof typeof ICON_MAP] || ICON_MAP.NOTE;
    const Icon = config.icon;

    const handleTriggerClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const getTitle = () => {
        switch (event.type) {
            case "MEDICAL_VISIT": return `Visit: ${event.doctor}`;
            case "MEDS": return `Meds: ${event.medicineName}`;
            case "HANDOVER": return `Handover at ${event.location}`;
            case "INCIDENT": return `Incident: ${event.severity}`;
            case "NOTE": return "Note";
            default: return event.type;
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    onClick={handleTriggerClick}
                    className={cn(
                        "p-1 rounded-md border transition-all hover:scale-110 active:scale-95",
                        config.color
                    )}
                >
                    <Icon className="w-3.5 h-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-64 p-3 shadow-xl border-slate-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="space-y-3">
                    <div className="flex items-start justify-between">
                        <div className={cn("p-2 rounded-lg border", config.color)}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(event.createdAt), "HH:mm")}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                            {getTitle()}
                        </h4>
                    </div>

                    {"description" in event && event.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-md">
                            {event.description}
                        </p>
                    )}

                    {"content" in event && event.content && (
                        <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-md">
                            {event.content}
                        </p>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-[11px] font-bold gap-2"
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails?.();
                        }}
                    >
                        View details
                        <ExternalLink className="w-3 h-3" />
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
