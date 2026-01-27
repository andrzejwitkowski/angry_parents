import { Paperclip, FileText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AttachmentItem } from "@/types/timeline.types";

interface AttachmentCardProps {
    item: AttachmentItem;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentCard({ item }: AttachmentCardProps) {
    const isImage = item.mimeType.startsWith("image/");

    return (
        <Card className="border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-500 rounded-lg">
                        <Paperclip className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-gray-900">Attachment</h3>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* File Preview/Thumbnail */}
                {isImage ? (
                    <div className="w-full h-48 rounded-lg bg-gray-200 border-2 border-gray-300 overflow-hidden">
                        <img
                            src={item.fileUrl}
                            alt={item.fileName}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div className="w-full h-32 rounded-lg bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                        <FileText className="w-12 h-12 text-gray-400" />
                    </div>
                )}

                {/* File Info */}
                <div className="bg-white/80 rounded-lg p-3">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                        {item.fileName}
                    </p>
                    <p className="text-xs text-gray-600">
                        {formatFileSize(item.fileSize)} • {item.mimeType}
                    </p>
                </div>

                <p className="text-xs text-gray-500 pt-2">
                    {new Date(item.createdAt).toLocaleString()}
                </p>
            </CardContent>
        </Card>
    );
}
