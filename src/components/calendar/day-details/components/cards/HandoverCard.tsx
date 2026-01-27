import { ArrowRightLeft, MapPin, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HandoverItem } from "@/types/timeline.types";
import { cn } from "@/lib/utils";

interface HandoverCardProps {
    item: HandoverItem;
}

export function HandoverCard({ item }: HandoverCardProps) {
    const isCompleted = item.status === "COMPLETED";

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
                        <h3 className="font-bold text-indigo-900">Child Handover</h3>
                    </div>
                    <Badge
                        variant="outline"
                        className={cn(
                            isCompleted
                                ? "bg-blue-100 text-blue-800 border-blue-300"
                                : "bg-amber-100 text-amber-800 border-amber-300"
                        )}
                    >
                        {item.status}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Location */}
                <div className="flex items-start gap-3 bg-white/80 rounded-lg p-3">
                    <MapPin className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                            Location
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
                            Time
                        </p>
                        <p className="text-base font-semibold text-gray-900">
                            {item.time}
                        </p>
                    </div>
                </div>

                {/* Timestamp */}
                <p className="text-xs text-gray-500 pt-2">
                    {new Date(item.createdAt).toLocaleString()}
                </p>
            </CardContent>
        </Card>
    );
}
