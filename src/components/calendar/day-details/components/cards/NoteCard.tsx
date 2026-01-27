import { StickyNote } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { NoteItem } from "@/types/timeline.types";

interface NoteCardProps {
    item: NoteItem;
}

export function NoteCard({ item }: NoteCardProps) {
    return (
        <Card className="border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-500 rounded-lg">
                        <StickyNote className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-slate-900">Note</h3>
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
