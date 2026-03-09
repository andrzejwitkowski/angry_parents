import { useState } from "react";
import { getMutationSignature } from "@/lib/signature-provider";
import { useTranslation } from "react-i18next";
import { ActionToolbar, type ActionMode } from "./ActionToolbar";
import { MedicalForm } from "./forms/MedicalForm";
import { HandoverForm } from "./forms/HandoverForm";
import { MedsForm } from "./forms/MedsForm";
import { IncidentForm } from "./forms/IncidentForm";
import { NoteForm } from "./forms/NoteForm";
import { VacationForm } from "./forms/VacationForm";
import { timelineApi } from "@/lib/api/timeline";
import type { CreateTimelineItemDto } from "@/types/timeline.types";
import { useSecurity } from "@/context/SecurityContext";

interface LogComposerProps {
    date: string; // YYYY-MM-DD
    onSuccess: () => void;
    createdBy: string;
    childId: string;
}

export function LogComposer({ date, onSuccess, createdBy, childId }: LogComposerProps) {
    const { t } = useTranslation();
    const { ensureUnlocked } = useSecurity();
    const [selectedMode, setSelectedMode] = useState<ActionMode | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleModeSelect = (mode: ActionMode) => {
        setSelectedMode(prev => (prev === mode ? null : mode));
    };

    const handleFormSubmit = async (formData: Record<string, unknown>) => {
        if (!selectedMode) return;
        if (!ensureUnlocked()) return;

        setIsSubmitting(true);
        try {
            const dto: CreateTimelineItemDto & { childId: string } = {
                type: selectedMode,
                date,
                createdBy,
                childId,
                ...(formData as Omit<CreateTimelineItemDto, "type" | "date" | "createdBy">),
            };

            await timelineApi.create(dto, await getMutationSignature());
            setSelectedMode(null);
            onSuccess();
        } catch (error) {
            console.error("Failed to add entry:", error);
            alert(error instanceof Error ? error.message : t("daylog.failedToAdd"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pt-4 border-t border-slate-100">
            <ActionToolbar selectedMode={selectedMode} onModeSelect={handleModeSelect} />

            {selectedMode && (
                <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-xl animate-in slide-in-from-bottom-4 transition-all">
                    {selectedMode === "MEDICAL_VISIT" && <MedicalForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} initialData={{ childIds: [childId] }} />}
                    {selectedMode === "HANDOVER" && <HandoverForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} initialData={{ childIds: [childId] }} />}
                    {selectedMode === "MEDS" && <MedsForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} initialData={{ childIds: [childId] }} />}
                    {selectedMode === "INCIDENT" && <IncidentForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} initialData={{ childIds: [childId] }} />}
                    {selectedMode === "NOTE" && <NoteForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} initialData={{ childIds: [childId] }} />}
                    {selectedMode === "VACATION" && <VacationForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} initialData={{ childIds: [childId] }} />}
                    {selectedMode === "ATTACHMENT" && (
                        <div className="p-4 text-center text-slate-500 italic">
                            {t("daylog.attachmentComingSoon")}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
