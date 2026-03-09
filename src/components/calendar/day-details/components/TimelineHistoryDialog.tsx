import { History, User, Calendar as CalendarIcon, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TimelineItem, AuditEntry } from "@/types/timeline.types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimelineHistoryDialogProps {
    item: TimelineItem;
    trigger?: React.ReactNode;
}

import { useChildren } from "@/hooks/useChildren";
import type { Child } from "@/lib/api/children";

export function TimelineHistoryDialog({ item, trigger }: TimelineHistoryDialogProps) {
    const { t } = useTranslation();
    const { children } = useChildren(); // Fetch children for mapping

    const sortedAudit = [...item.auditTrail].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-slate-500 hover:text-slate-900">
                        <History className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">{t("common.history")}</span>
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        {t("timeline.auditLog")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("timeline.auditLog")}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="pr-4 mt-4">
                    <div className="space-y-6 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {sortedAudit.map((entry, index) => (
                            <AuditEntryRow key={index} entry={entry} isLatest={index === 0} childrenMap={children} />
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

function AuditEntryRow({ entry, isLatest, childrenMap }: { entry: AuditEntry; isLatest: boolean; childrenMap: Child[] }) {
    const { t } = useTranslation();

    const getActionColor = () => {
        switch (entry.action) {
            case "CREATED": return "bg-green-100 text-green-700 border-green-200";
            case "UPDATED": return "bg-blue-100 text-blue-700 border-blue-200";
            case "DELETED": return "bg-red-100 text-red-700 border-red-200";
            default: return "bg-slate-100 text-slate-700 border-slate-200";
        }
    };

    const formatValue = (field: string, value: unknown) => {
        if (field === "childIds" && Array.isArray(value)) {
            const ids = value as string[];
            if (ids.length === 0) return t("timeline.noChildrenAssigned");

            const names = ids.map(id => {
                const child = childrenMap.find(c => c.id === id);
                return child ? child.name : id;
            });
            return names.join(", ");
        }

        return typeof value === "boolean" ? (value ? "Yes" : "No") :
            typeof value === "object" ? JSON.stringify(value) : String(value);
    };

    return (
        <div className="relative pl-10">
            <div className={`absolute left-0 top-1 w-9 h-9 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-colors z-10 ${isLatest ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                {entry.action === "CREATED" ? <CalendarIcon size={14} /> :
                    entry.action === "DELETED" ? <Info size={14} /> :
                        <History size={14} />}
            </div>

            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider h-5 ${getActionColor()}`}>
                        {t(`timeline.action.${entry.action}`)}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-medium italic">
                        {new Date(entry.timestamp).toLocaleString()}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 py-0.5">
                    <User size={12} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700">
                        {entry.userName || t("common.anonymous")}
                    </span>
                </div>

                {entry.changes && Object.keys(entry.changes).length > 0 && (
                    <div className="mt-2 bg-slate-50/50 rounded-md p-2 border border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-tight">{t("timeline.fieldChanges")}:</p>
                        <div className="grid grid-cols-1 gap-1.5">
                            {Object.entries(entry.changes).map(([field, value]) => (
                                <div key={field} className="flex flex-col gap-0.5">
                                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100/50 px-1.5 py-0.5 rounded w-fit">
                                        {field}
                                    </span>
                                    <span className="text-[11px] text-slate-800 break-all pl-1.5 border-l-2 border-slate-200">
                                        {formatValue(field, value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
