import { Plane, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VacationItem } from "@/types/timeline.types";
import type { User } from "@/types/user";
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

interface VacationCardProps {
    item: VacationItem;
    user: User | null;
    onUpdate?: (updatedItem: VacationItem) => void;
    onDelete?: () => void;
}

export function VacationCard({ item, user, onUpdate: _onUpdate, onDelete }: VacationCardProps) {
    const { t } = useTranslation();
    const isOwner = user?.id === item.createdBy;

    const handleDelete = async () => {
        try {
            await timelineApi.delete(item.id);
            onDelete?.();
        } catch (error) {
            console.error("Failed to delete vacation:", error);
        }
    };
    return (
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-500 rounded-lg">
                            <Plane className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold text-amber-900">Vacation</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                            {item.status}
                        </Badge>
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
                                            {t("vacation.confirmDelete")}
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
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                    </p>
                    {item.createdByName && (
                        <p className="text-xs text-gray-400 font-medium">
                            Added by {item.createdByName}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
