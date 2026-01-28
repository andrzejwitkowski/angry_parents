import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IncidentItem } from "@/types/timeline.types";
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


const severityConfig = {
    LOW: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        gradient: "from-yellow-50 to-amber-50",
        border: "border-yellow-300",
        icon: "bg-yellow-500",
    },
    MEDIUM: {
        color: "bg-orange-100 text-orange-800 border-orange-300",
        gradient: "from-orange-50 to-red-50",
        border: "border-orange-300",
        icon: "bg-orange-500",
    },
    HIGH: {
        color: "bg-red-100 text-red-800 border-red-300",
        gradient: "from-red-50 to-rose-50",
        border: "border-red-400",
        icon: "bg-red-600",
    },
};

interface IncidentCardProps {
    item: IncidentItem;
    user: User | null;
    onUpdate?: (updatedItem: IncidentItem) => void;
    onDelete?: () => void;
}

export function IncidentCard({ item, user, onUpdate: _onUpdate, onDelete }: IncidentCardProps) {
    const { t } = useTranslation();
    const isOwner = user?.id === item.createdBy;
    const config = severityConfig[item.severity];

    const handleDelete = async () => {
        try {
            await timelineApi.delete(item.id);
            onDelete?.();
        } catch (error) {
            console.error("Failed to delete incident report:", error);
        }
    };

    return (
        <Card className={cn(
            "border-2 bg-gradient-to-br shadow-md hover:shadow-lg transition-shadow",
            config.border,
            config.gradient
        )}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-lg", config.icon)}>
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold text-red-900">Incident Report</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={config.color}>
                            {item.severity}
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
                                            {t("incident.confirmDelete")}
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
                {/* Description */}
                <div className="bg-white/80 rounded-lg p-4 border-l-4 border-red-500">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                        Description
                    </p>
                    <p className="text-base text-gray-900 leading-relaxed">
                        {item.description}
                    </p>
                </div>

                {/* Timestamp */}
                <div className="flex justify-between items-center pt-2">
                    <p className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                    </p>
                    {item.createdByName && (
                        <p className="text-xs text-gray-400 font-medium">
                            Reported by {item.createdByName}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
