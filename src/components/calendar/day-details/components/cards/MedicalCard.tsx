import { createMockSignature } from "@/lib/mocks/cryptoMock";

import { Stethoscope, FileText, Trash2, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MedicalVisitItem } from "@/types/timeline.types";
import type { User } from "@/types/user";
import { timelineApi } from "@/lib/api/timeline";
import { cn } from "@/lib/utils";
import { AuditIndicator } from "../AuditIndicator";
import { TimelineEditDialog } from "../TimelineEditDialog";

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

interface MedicalCardProps {
    item: MedicalVisitItem;
    user: User | null;
    onUpdate?: (updatedItem: MedicalVisitItem) => void;
    onDelete?: () => void;
}

export function MedicalCard({ item, user, onUpdate, onDelete }: MedicalCardProps) {
    const { t } = useTranslation();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const isOwner = user?.id === item.createdBy;

    const handleDelete = async () => {
        try {
            await timelineApi.delete(item.id, createMockSignature());
            onDelete?.();
        } catch (error) {
            console.error("Failed to delete medical visit:", error);
        }
    };
    return (
        <Card className={cn(
            "border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50",
            "shadow-md hover:shadow-lg transition-shadow"
        )}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500 rounded-lg">
                            <Stethoscope className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-emerald-900">
                                {(item as any).doctor ?? (
                                    <span className="text-xs text-slate-400 italic">🔒 Encrypted</span>
                                )}
                            </h3>
                            {(item as any).specialization && (
                                <p className="text-sm text-emerald-700">{(item as any).specialization}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                            {t("medical.cardBadge")}
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
                                                {t("medical.confirmDelete")}
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
                {/* Diagnosis - Prominently displayed */}
                <div className="bg-white/80 rounded-lg p-4 border-l-4 border-emerald-500">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                        {t("medical.diagnosis").replace("*", "")}
                    </p>
                    <p className="text-lg font-bold text-emerald-900">
                        {(item as any).diagnosis ?? (
                            <span className="text-xs text-slate-400 italic">🔒 Encrypted</span>
                        )}
                    </p>
                </div>

                {/* Recommendations */}
                {item.recommendations && (
                    <div className="bg-white/60 rounded-lg p-3">
                        <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">
                            {t("medical.recommendations")}
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {item.recommendations}
                        </p>
                    </div>
                )}

                {/* Attachments */}
                {item.attachments && item.attachments.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {t("medical.attachments", { count: item.attachments.length })}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {item.attachments.map((url, index) => (
                                <div
                                    key={index}
                                    className="w-16 h-16 rounded-lg bg-gray-200 border-2 border-emerald-200 overflow-hidden"
                                >
                                    <img
                                        src={url}
                                        alt={`Attachment ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Timestamp */}
                <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                    </p>
                    {item.createdByName && (
                        <p className="text-xs text-gray-400 font-medium">
                            {t("medical.addedBy", { name: item.createdByName })}
                        </p>
                    )}
                    <AuditIndicator item={item} />
                </div>
            </CardContent>
            <TimelineEditDialog
                item={item}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onSuccess={(updated) => onUpdate?.(updated as MedicalVisitItem)}
            />
        </Card>
    );
}
