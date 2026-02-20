import { Stethoscope, Pill, ArrowRightLeft, AlertTriangle, StickyNote, Plane, Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";
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
    { mode: "MEDICAL_VISIT" as const, icon: Stethoscope, labelKey: "daylog.medicalVisit", color: "text-emerald-600" },
    { mode: "MEDS" as const, icon: Pill, labelKey: "daylog.medication", color: "text-purple-600" },
    { mode: "HANDOVER" as const, icon: ArrowRightLeft, labelKey: "daylog.handover", color: "text-indigo-600" },
    { mode: "INCIDENT" as const, icon: AlertTriangle, labelKey: "daylog.incident", color: "text-red-600" },
    { mode: "NOTE" as const, icon: StickyNote, labelKey: "daylog.note", color: "text-slate-600" },
    { mode: "VACATION" as const, icon: Plane, labelKey: "daylog.vacation", color: "text-amber-600" },
    { mode: "ATTACHMENT" as const, icon: Paperclip, labelKey: "daylog.attachment", color: "text-gray-600" },
];

export function ActionToolbar({ selectedMode, onModeSelect }: ActionToolbarProps) {
    const { t } = useTranslation();

    return (
        <TooltipProvider>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-sm font-semibold text-slate-700 mr-2">{t("daylog.add")}</span>
                <div className="flex gap-1 flex-wrap">
                    {actions.map(({ mode, icon: Icon, labelKey, color }) => (
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
                                <p>{t(labelKey)}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            </div>
        </TooltipProvider>
    );
}
