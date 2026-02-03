import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane } from "lucide-react";
import { ChildSelector } from "../components/ChildSelector";

const vacationSchema = z.object({
    status: z.string().min(1, "Status is required"),
    childIds: z.array(z.string()),
});

type VacationFormData = z.infer<typeof vacationSchema>;

interface VacationFormProps {
    initialData?: VacationFormData;
    onSubmit: (data: VacationFormData) => void;
    isSubmitting?: boolean;
}

export function VacationForm({ initialData, onSubmit, isSubmitting }: VacationFormProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<VacationFormData>({
        resolver: zodResolver(vacationSchema),
        defaultValues: {
            status: initialData?.status || "",
            childIds: initialData?.childIds || [],
        },
    });

    const selectedChildIds = watch("childIds");

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
                <Plane className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Vacation Status</h3>
            </div>

            <ChildSelector
                selectedIds={selectedChildIds}
                onChange={(ids) => setValue("childIds", ids, { shouldValidate: true })}
            />

            <div className="space-y-2">
                <Label htmlFor="status">Vacation Status*</Label>
                <Input
                    id="status"
                    {...register("status")}
                    placeholder="e.g. On holiday, Airport, Beach..."
                    className={errors.status ? "border-red-500" : ""}
                />
                {errors.status && (
                    <p className="text-xs text-red-500">{errors.status.message}</p>
                )}
            </div>

            <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700"
                disabled={isSubmitting}
                data-testid="submit-vacation"
            >
                {isSubmitting ? (initialData ? "Saving..." : "Adding...") : (initialData ? "Update Vacation Status" : "Add Vacation Status")}
            </Button>
        </form>
    );
}
