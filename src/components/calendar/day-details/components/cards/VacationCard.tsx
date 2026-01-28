import { Plane, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VacationItem } from "@/types/timeline.types";
import { timelineApi } from "@/lib/api/timeline";

interface VacationCardProps {
    item: VacationItem;
    user: any;
    onUpdate?: () => void;
}

export function VacationCard({ item, user, onUpdate }: VacationCardProps) {
    const { t } = useTranslation();
    const isOwner = user?.id === item.createdBy;

    const handleDelete = async () => {
        if (!confirm(t("vacation.confirmDelete"))) return;
        try {
            await timelineApi.delete(item.id);
            onUpdate?.();
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
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                onClick={handleDelete}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                <p className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString()}
                </p>
            </CardContent>
        </Card>
    );
}
