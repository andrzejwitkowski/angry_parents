import { ArrowRightLeft, MapPin, Clock, Trash2, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HandoverItem } from "@/types/timeline.types";
import type { User } from "@/types/user";
import { timelineApi } from "@/lib/api/timeline";
import { cn } from "@/lib/utils";
import { AuditIndicator } from "../AuditIndicator";
import { TimelineEditDialog } from "../TimelineEditDialog";
import { ChildIndicators } from "../ChildIndicators";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface HandoverCardProps {
    item: HandoverItem;
    user: User | null;
    onUpdate?: (updatedItem: HandoverItem) => void;
    onDelete?: () => void;
}

export function HandoverCard({ item, user, onUpdate, onDelete }: HandoverCardProps) {
    const { t } = useTranslation();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const isOwner = user?.id === item.createdBy;
    const isCompleted = item.status === "COMPLETED";

    const handleDelete = async () => {
        try {
            await timelineApi.delete(item.id);
            onDelete?.();
        } catch (error) {
            console.error("Failed to delete handover:", error);
        }
    };

    return (
        <Card className={cn(
            "border-2 bg-gradient-to-br",
            isCompleted
                ? "border-blue-200 from-blue-50 to-indigo-50"
                : "border-indigo-200 from-indigo-50 to-purple-50",
            "shadow-md hover:shadow-lg transition-shadow"
        )}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "p-2 rounded-lg",
                            isCompleted ? "bg-blue-500" : "bg-indigo-500"
                        )}>
                            <ArrowRightLeft className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="font-bold text-indigo-900">{t("handover.cardTitle")}</h3>
                            <ChildIndicators childIds={item.childIds} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className={cn(
                                isCompleted
                                    ? "bg-blue-100 text-blue-800 border-blue-300"
                                    : "bg-amber-100 text-amber-800 border-amber-300"
                            )}
                        >
                            {isCompleted ? t("handover.statusCompleted") : t("handover.statusPending")}
                        </Badge>
                        {isOwner && (
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                    onClick={() => setIsEditDialogOpen(true)}
                                    data-testid="edit-button"
                                >
                                    <Pencil className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                            data-testid="delete-button"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t("common.deleteTitle")}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t("handover.confirmDelete")}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDelete}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                {t("common.confirm")}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Location */}
                <div className="flex items-start gap-3 bg-white/80 rounded-lg p-3">
                    <MapPin className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                            {t("handover.locationLabel")}
                        </p>
                        <p className="text-base font-semibold text-gray-900">
                            {item.location}
                        </p>
                    </div>
                </div>

                {/* Time */}
                <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
                    <Clock className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                            {t("handover.timeLabel")}
                        </p>
                        <p className="text-base font-semibold text-gray-900">
                            {item.time}
                        </p>
                    </div>
                </div>

                {/* Timestamp */}
                <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                    </p>
                    {item.createdByName && (
                        <p className="text-xs text-gray-400 font-medium">
                            {t("daylog.addedBy", { name: item.createdByName })}
                        </p>
                    )}
                    <AuditIndicator item={item} />
                </div>
            </CardContent>
            <TimelineEditDialog
                item={item}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onSuccess={(updated) => onUpdate?.(updated as HandoverItem)}
            />
        </Card>
    );
}
