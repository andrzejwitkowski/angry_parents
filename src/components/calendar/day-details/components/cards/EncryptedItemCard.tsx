import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { EncryptedTimelineItem } from "@/types/timeline.types";
import { AuditIndicator } from "../AuditIndicator";

interface EncryptedItemCardProps {
    item: EncryptedTimelineItem;
}

export function EncryptedItemCard({ item }: EncryptedItemCardProps) {
    const { t } = useTranslation();
    const hasPrivateKey = typeof window !== "undefined" && Boolean(
        window.localStorage.getItem("zk_private_key")
        || window.localStorage.getItem("zkPrivateKey")
        || window.localStorage.getItem("privateKey")
        || window.localStorage.getItem("rsaPrivateKey")
        || (import.meta as any).env.VITE_DEV_RSA_PRIVATE_KEY
    );

    return (
        <Card className="border-2 border-slate-200 bg-slate-50 shadow-sm opacity-80">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-200 rounded-lg">
                        <Lock className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-700">{t("daylog.encryptedEntry")}</h3>
                        <p className="text-xs text-slate-500 italic">
                            {hasPrivateKey ? t("common.decryptionFailed") : t("common.privateKeyMissing")}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="bg-white/50 rounded-lg p-4 border border-dashed border-slate-300">
                    <p className="text-sm text-slate-500 text-center italic">
                        {hasPrivateKey ? t("daylog.encryptedContentNotice") : t("daylog.privateKeyMissingNotice")}
                    </p>
                </div>
                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100">
                    <p className="text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleString()}
                    </p>
                    <AuditIndicator item={item} />
                </div>
            </CardContent>
        </Card>
    );
}
