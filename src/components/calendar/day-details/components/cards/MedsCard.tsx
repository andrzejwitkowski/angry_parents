import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pill, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MedsItem } from "@/types/timeline.types";
import type { User } from "@/types/user";
import { timelineApi } from "@/lib/api/timeline";
import { cn } from "@/lib/utils";

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

interface MedsCardProps {
    item: MedsItem;
    user: User | null;
    onUpdate?: (updatedItem: MedsItem) => void;
    onDelete?: () => void;
}

export function MedsCard({ item, onUpdate, onDelete, user }: MedsCardProps) {
    const { t } = useTranslation();
    const isOwner = user?.id === item.createdBy;
    const [isUpdating, setIsUpdating] = useState(false);
    const [administered, setAdministered] = useState(item.administered);

    const handleCheckboxChange = async (checked: boolean) => {
        setIsUpdating(true);
        try {
            const updated = await timelineApi.update(item.id, { administered: checked });
            setAdministered(checked);
            onUpdate?.(updated as MedsItem);
        } catch (error) {
            console.error("Failed to update medication status:", error);
            // Revert on error
            setAdministered(!checked);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        try {
            await timelineApi.delete(item.id);
            onDelete?.();
        } catch (error) {
            console.error("Failed to delete medication:", error);
        }
    };

    return (
        <Card className={cn(
            "border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50",
            "shadow-md hover:shadow-lg transition-shadow",
            administered && "opacity-75"
        )}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-500 rounded-lg">
                            <Pill className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold text-purple-900">Medication</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className={cn(
                                administered
                                    ? "bg-green-100 text-green-800 border-green-300"
                                    : "bg-amber-100 text-amber-800 border-amber-300"
                            )}
                        >
                            {administered ? "Administered" : "Pending"}
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
                                            {t("meds.confirmDelete")}
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
                {/* Medicine Name */}
                <div className="bg-white/80 rounded-lg p-3">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
                        Medicine
                    </p>
                    <p className="text-lg font-bold text-purple-900">
                        {item.medicineName}
                    </p>
                </div>

                {/* Dosage */}
                <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
                        Dosage
                    </p>
                    <p className="text-base text-gray-900 font-medium">
                        {item.dosage}
                    </p>
                </div>

                {/* Administered Checkbox */}
                <div className="flex items-center gap-3 bg-white/80 rounded-lg p-3">
                    <Checkbox
                        id={`meds-${item.id}`}
                        checked={administered}
                        onCheckedChange={handleCheckboxChange}
                        disabled={isUpdating || !isOwner}
                        data-testid="meds-checkbox"
                    />
                    <label
                        htmlFor={`meds-${item.id}`}
                        className={cn(
                            "text-sm font-medium cursor-pointer",
                            administered ? "text-green-700 line-through" : "text-gray-900"
                        )}
                    >
                        Mark as administered
                    </label>
                </div>

                {/* Timestamp */}
                <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                    </p>
                    {item.createdByName && (
                        <p className="text-xs text-gray-400 font-medium">
                            Administered by {item.createdByName}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
