import { useState } from "react";
import { ActionToolbar, type ActionMode } from "./ActionToolbar";
import { MedicalForm } from "./forms/MedicalForm";
import { HandoverForm } from "./forms/HandoverForm";
import { MedsForm } from "./forms/MedsForm";
import { IncidentForm } from "./forms/IncidentForm";
import { NoteForm } from "./forms/NoteForm";
import { VacationForm } from "./forms/VacationForm";
import { timelineApi } from "@/lib/api/timeline";
import type { CreateTimelineItemDto } from "@/types/timeline.types";

interface LogComposerProps {
    date: string; // YYYY-MM-DD
    onSuccess: () => void;
    createdBy: string;
}

export function LogComposer({ date, onSuccess, createdBy }: LogComposerProps) {
    const [selectedMode, setSelectedMode] = useState<ActionMode | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleModeSelect = (mode: ActionMode) => {
        setSelectedMode(prev => (prev === mode ? null : mode));
    };

    const handleFormSubmit = async (formData: any) => {
        if (!selectedMode) return;

        setIsSubmitting(true);
        try {
            const dto: CreateTimelineItemDto = {
                type: selectedMode,
                date,
                createdBy,
                ...formData,
            };

            await timelineApi.create(dto);
            setSelectedMode(null);
            onSuccess();
        } catch (error) {
            console.error("Failed to add entry:", error);
            alert(error instanceof Error ? error.message : "Failed to add entry");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pt-4 border-t border-slate-100">
            <ActionToolbar selectedMode={selectedMode} onModeSelect={handleModeSelect} />

            {selectedMode && (
                <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-xl animate-in slide-in-from-bottom-4 transition-all">
                    {selectedMode === "MEDICAL_VISIT" && <MedicalForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} />}
                    {selectedMode === "HANDOVER" && <HandoverForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} />}
                    {selectedMode === "MEDS" && <MedsForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} />}
                    {selectedMode === "INCIDENT" && <IncidentForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} />}
                    {selectedMode === "NOTE" && <NoteForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} />}
                    {selectedMode === "VACATION" && <VacationForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} />}
                    {selectedMode === "ATTACHMENT" && (
                        <div className="p-4 text-center text-slate-500 italic">
                            Attachment form coming soon...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
