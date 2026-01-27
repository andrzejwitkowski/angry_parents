import { useState } from "react";
import { Pill } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { MedsItem } from "@/types/timeline.types";
import { timelineApi } from "@/lib/api/timeline";
import { cn } from "@/lib/utils";

interface MedsCardProps {
    item: MedsItem;
    onUpdate?: (updatedItem: MedsItem) => void;
}

export function MedsCard({ item, onUpdate }: MedsCardProps) {
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
                        disabled={isUpdating}
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
                <p className="text-xs text-gray-500 pt-2">
                    {new Date(item.createdAt).toLocaleString()}
                </p>
            </CardContent>
        </Card>
    );
}
