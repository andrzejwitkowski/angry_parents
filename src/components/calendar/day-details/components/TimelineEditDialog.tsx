import { getMutationSignature } from "@/lib/signature-provider";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { MedicalForm } from "../composer/forms/MedicalForm";
import { HandoverForm } from "../composer/forms/HandoverForm";
import { MedsForm } from "../composer/forms/MedsForm";
import { IncidentForm } from "../composer/forms/IncidentForm";
import { NoteForm } from "../composer/forms/NoteForm";
import { VacationForm } from "../composer/forms/VacationForm";
import { timelineApi } from "@/lib/api/timeline";
import type { TimelineItem } from "@/types/timeline.types";

interface TimelineEditDialogProps {
    item: TimelineItem;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (updatedItem: TimelineItem) => void;
}

export function TimelineEditDialog({ item, open, onOpenChange, onSuccess }: TimelineEditDialogProps) {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFormSubmit = async (formData: Record<string, unknown>) => {
        const childId = item.childIds[0];
        if ((item as any).ciphertext || !childId) {
            console.warn("Cannot edit encrypted item");
            alert(t("daylog.cannotEditEncrypted"));
            return;
        }

        const itemData = item as Record<string, unknown>;
        if (
            (item.type === "MEDS" && (typeof itemData.medicineName !== "string" || typeof itemData.dosage !== "string")) ||
            (item.type === "MEDICAL_VISIT" && (typeof itemData.doctor !== "string" || typeof itemData.diagnosis !== "string")) ||
            (item.type === "HANDOVER" && (typeof itemData.location !== "string" || typeof itemData.time !== "string" || typeof itemData.status !== "string")) ||
            (item.type === "INCIDENT" && (typeof itemData.description !== "string" || typeof itemData.severity !== "string")) ||
            (item.type === "NOTE" && typeof itemData.content !== "string") ||
            (item.type === "VACATION" && typeof itemData.status !== "string")
        ) {
            console.warn("Cannot edit non-plaintext item");
            alert(t("daylog.cannotEditEncrypted"));
            return;
        }

        setIsSubmitting(true);
        try {
            const updated = await timelineApi.update(
                item.id,
                { ...item, ...formData },
                await getMutationSignature(),
                childId
            );
            onSuccess(updated);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update entry:", error);
            alert(error instanceof Error ? error.message : t("daylog.failedToUpdate"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t("daylog.editEntry")}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    {item.type === "MEDICAL_VISIT" && (
                        <MedicalForm
                            initialData={item as any as import("@/types/timeline.types").MedicalVisitItem}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "HANDOVER" && (
                        <HandoverForm
                            initialData={item as any as import("@/types/timeline.types").HandoverItem}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "MEDS" && (
                        <MedsForm
                            initialData={item as any as import("@/types/timeline.types").MedsItem}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "INCIDENT" && (
                        <IncidentForm
                            initialData={item as any as import("@/types/timeline.types").IncidentItem}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "NOTE" && (
                        <NoteForm
                            initialData={item as any as import("@/types/timeline.types").NoteItem}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "VACATION" && (
                        <VacationForm
                            initialData={item as any as import("@/types/timeline.types").VacationItem}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
