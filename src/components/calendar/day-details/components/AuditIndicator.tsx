import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TimelineHistoryDialog } from "./TimelineHistoryDialog";
import type { TimelineItem } from "@/types/timeline.types";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function AuditIndicator({ item }: { item: TimelineItem }) {
    const { t } = useTranslation();
    const isModified = item.auditTrail.length > 1;

    if (!isModified) return null;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <TimelineHistoryDialog
                        item={item}
                        trigger={
                            <div data-testid="audit-indicator" className="flex items-center gap-1.5 cursor-pointer hover:bg-amber-100 rounded-full px-2.5 py-1 transition-all border border-amber-200 bg-amber-50 shadow-sm hover:shadow-md animate-in fade-in zoom-in duration-300">
                                <History className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                                    {t("common.modified")}
                                </span>
                            </div>
                        }
                    />
                </TooltipTrigger>
                <TooltipContent>
                    <p className="text-xs">{t("timeline.clickToShowHistory")}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
