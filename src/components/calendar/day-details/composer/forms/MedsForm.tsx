import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "lucide-react";

const medsSchema = z.object({
    medicineName: z.string().min(1, "Medicine name is required"),
    dosage: z.string().min(1, "Dosage is required"),
});

type MedsFormData = z.infer<typeof medsSchema>;

interface MedsFormProps {
    onSubmit: (data: MedsFormData) => void;
    isSubmitting?: boolean;
}

export function MedsForm({ onSubmit, isSubmitting }: MedsFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<MedsFormData>({
        resolver: zodResolver(medsSchema),
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Pill className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Medication Details</h3>
            </div>

            <div className="space-y-2">
                <Label htmlFor="medicineName">Medicine Name*</Label>
                <Input
                    id="medicineName"
                    {...register("medicineName")}
                    placeholder="e.g. Paracetamol, Ibuprofen"
                    className={errors.medicineName ? "border-red-500" : ""}
                />
                {errors.medicineName && (
                    <p className="text-xs text-red-500">{errors.medicineName.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="dosage">Dosage*</Label>
                <Input
                    id="dosage"
                    {...register("dosage")}
                    placeholder="e.g. 500mg, 5ml"
                    className={errors.dosage ? "border-red-500" : ""}
                />
                {errors.dosage && (
                    <p className="text-xs text-red-500">{errors.dosage.message}</p>
                )}
            </div>

            <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={isSubmitting}
                data-testid="submit-meds"
            >
                {isSubmitting ? "Adding..." : "Add Medication"}
            </Button>
        </form>
    );
}
