import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StickyNote } from "lucide-react";

const noteSchema = z.object({
    content: z.string().min(1, "Note content is required"),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface NoteFormProps {
    onSubmit: (data: NoteFormData) => void;
    isSubmitting?: boolean;
}

export function NoteForm({ onSubmit, isSubmitting }: NoteFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<NoteFormData>({
        resolver: zodResolver(noteSchema),
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-2 text-slate-600 mb-2">
                <StickyNote className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Daily Note</h3>
            </div>

            <div className="space-y-2">
                <Label htmlFor="content">Content*</Label>
                <Textarea
                    id="content"
                    {...register("content")}
                    placeholder="Write your note here..."
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
                {isSubmitting ? "Adding..." : "Add Note"}
            </Button>
        </form>
    );
}
