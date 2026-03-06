import { getMutationSignature } from "@/lib/signature-provider";

import { StickyNote, Trash2, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { NoteItem } from "@/types/timeline.types";
import { timelineApi } from "@/lib/api/timeline";
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
import type { User } from "@/types/user";

interface NoteCardProps {
    item: NoteItem;
    user: User | null;
    onUpdate?: (updatedItem: NoteItem) => void;
    onDelete?: () => void;
}

export function NoteCard({ item, user, onUpdate, onDelete }: NoteCardProps) {
    const { t } = useTranslation();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const isOwner = user?.id === item.createdBy;

    const handleDelete = async () => {
        try {
            await timelineApi.delete(item.id, await getMutationSignature());
            onDelete?.();
        } catch (error) {
            console.error("Failed to delete note:", error);
        }
    };

    return (
        <Card className="border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-500 rounded-lg">
                            <StickyNote className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="font-bold text-slate-900">{t("note.cardTitle")}</h3>
                            <ChildIndicators childIds={item.childIds} />
                        </div>
                    </div>
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
                                            {t("note.confirmDelete")}
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
            </CardHeader>

            <CardContent className="space-y-3">
                <div className="bg-white/80 rounded-lg p-3">
                    <p className="text-base text-gray-900 leading-relaxed">
                        {item.content}
                    </p>
                </div>

                <div className="flex items-center justify-between pt-2">
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
                onSuccess={(updated) => onUpdate?.(updated as NoteItem)}
            />
        </Card>
    );
}
