import { Plane } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { VacationItem } from "@/types/timeline.types";

interface VacationCardProps {
    item: VacationItem;
}

export function VacationCard({ item }: VacationCardProps) {
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
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        {item.status}
                    </Badge>
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
