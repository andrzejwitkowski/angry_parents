import { Stethoscope, Pill, ArrowRightLeft, AlertTriangle, StickyNote, Plane, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ActionMode =
    | "NOTE"
    | "HANDOVER"
    | "MEDS"
    | "MEDICAL_VISIT"
    | "INCIDENT"
    | "VACATION"
    | "ATTACHMENT";

interface ActionToolbarProps {
    selectedMode: ActionMode | null;
    onModeSelect: (mode: ActionMode) => void;
}

const actions = [
    { mode: "MEDICAL_VISIT" as const, icon: Stethoscope, label: "Medical Visit", color: "text-emerald-600" },
    { mode: "MEDS" as const, icon: Pill, label: "Medication", color: "text-purple-600" },
    { mode: "HANDOVER" as const, icon: ArrowRightLeft, label: "Handover", color: "text-indigo-600" },
    { mode: "INCIDENT" as const, icon: AlertTriangle, label: "Incident", color: "text-red-600" },
    { mode: "NOTE" as const, icon: StickyNote, label: "Note", color: "text-slate-600" },
    { mode: "VACATION" as const, icon: Plane, label: "Vacation", color: "text-amber-600" },
    { mode: "ATTACHMENT" as const, icon: Paperclip, label: "Attachment", color: "text-gray-600" },
];

export function ActionToolbar({ selectedMode, onModeSelect }: ActionToolbarProps) {
    return (
        <TooltipProvider>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-sm font-semibold text-slate-700 mr-2">Add:</span>
                <div className="flex gap-1 flex-wrap">
                    {actions.map(({ mode, icon: Icon, label, color }) => (
                        <Tooltip key={mode}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={selectedMode === mode ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => onModeSelect(mode)}
                                    className={cn(
                                        "h-10 w-10 p-0",
                                        selectedMode === mode && "shadow-md"
                                    )}
                                    data-testid={`action-${mode.toLowerCase()}`}
                                >
                                    <Icon className={cn("w-5 h-5", selectedMode === mode ? "text-white" : color)} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{label}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            </div>
        </TooltipProvider>
    );
}
