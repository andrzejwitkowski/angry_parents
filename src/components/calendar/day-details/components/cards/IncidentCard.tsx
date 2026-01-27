import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { IncidentItem } from "@/types/timeline.types";
import { cn } from "@/lib/utils";

interface IncidentCardProps {
    item: IncidentItem;
}

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

export function IncidentCard({ item }: IncidentCardProps) {
    const config = severityConfig[item.severity];

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
                    <Badge variant="outline" className={config.color}>
                        {item.severity}
                    </Badge>
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
                <p className="text-xs text-gray-500 pt-2">
                    {new Date(item.createdAt).toLocaleString()}
                </p>
            </CardContent>
        </Card>
    );
}
