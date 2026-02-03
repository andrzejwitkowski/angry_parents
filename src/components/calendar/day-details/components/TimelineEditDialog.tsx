import { useState } from "react";
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFormSubmit = async (formData: any) => {
        setIsSubmitting(true);
        try {
            const updated = await timelineApi.update(item.id, formData);
            onSuccess(updated);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update entry:", error);
            alert(error instanceof Error ? error.message : "Failed to update entry");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Entry</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    {item.type === "MEDICAL_VISIT" && (
                        <MedicalForm
                            initialData={item as any}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "HANDOVER" && (
                        <HandoverForm
                            initialData={item as any}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "MEDS" && (
                        <MedsForm
                            initialData={item as any}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "INCIDENT" && (
                        <IncidentForm
                            initialData={item as any}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "NOTE" && (
                        <NoteForm
                            initialData={item as any}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                    {item.type === "VACATION" && (
                        <VacationForm
                            initialData={item as any}
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
