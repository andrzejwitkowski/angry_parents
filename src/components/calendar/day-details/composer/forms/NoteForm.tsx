import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StickyNote } from "lucide-react";
import { ChildSelector } from "../components/ChildSelector";

const noteSchema = z.object({
    content: z.string().min(1, "Note content is required"),
    childIds: z.array(z.string()),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface NoteFormProps {
    initialData?: NoteFormData;
    onSubmit: (data: NoteFormData) => void;
    isSubmitting?: boolean;
}

export function NoteForm({ initialData, onSubmit, isSubmitting }: NoteFormProps) {
    const { t } = useTranslation();
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<NoteFormData>({
        resolver: zodResolver(noteSchema),
        defaultValues: {
            content: initialData?.content || "",
            childIds: initialData?.childIds || [],
        },
    });

    // eslint-disable-next-line react-hooks/incompatible-library
    const selectedChildIds = watch("childIds");

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center gap-2 text-slate-600 mb-2">
                <StickyNote className="w-5 h-5" />
                <h3 className="font-semibold text-lg">{t("note.details")}</h3>
            </div>

            <ChildSelector
                selectedIds={selectedChildIds}
                onChange={(ids) => setValue("childIds", ids, { shouldValidate: true })}
            />

            <div className="space-y-2">
                <Label htmlFor="content">{t("note.contentLabel")}*</Label>
                <Textarea
                    id="content"
                    {...register("content")}
                    placeholder={t("note.contentPlaceholder")}
                    className={errors.content ? "border-red-500" : ""}
                />
                {errors.content && (
                    <p className="text-xs text-red-500">{errors.content.message}</p>
                )}
            </div>

            <Button
                type="submit"
                className="w-full bg-slate-600 hover:bg-slate-700"
                disabled={isSubmitting}
                data-testid="submit-note"
            >
                {isSubmitting ? (initialData ? t("note.saving") : t("note.adding")) : (initialData ? t("note.updateSubmit") : t("note.addSubmit"))}
            </Button>
        </form>
    );
}
