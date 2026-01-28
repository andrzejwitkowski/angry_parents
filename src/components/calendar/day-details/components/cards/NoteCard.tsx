import { StickyNote, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { NoteItem } from "@/types/timeline.types";
import { timelineApi } from "@/lib/api/timeline";

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

export function NoteCard({ item, user, onUpdate: _onUpdate, onDelete }: NoteCardProps) {
    const { t } = useTranslation();
    const isOwner = user?.id === item.createdBy;

    const handleDelete = async () => {
        try {
            await timelineApi.delete(item.id);
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
                        <h3 className="font-bold text-slate-900">Note</h3>
                    </div>
                    {isOwner && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
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
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                <div className="bg-white/80 rounded-lg p-3">
                    <p className="text-base text-gray-900 leading-relaxed">
                        {item.content}
                    </p>
                </div>

                <p className="text-xs text-gray-500 pt-2">
                    {new Date(item.createdAt).toLocaleString()}
                </p>
            </CardContent>
        </Card>
    );
}
