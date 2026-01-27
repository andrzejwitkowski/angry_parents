import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Stethoscope } from "lucide-react";

const medicalSchema = z.object({
    doctor: z.string().min(1, "Doctor name is required"),
    specialization: z.string().optional(),
    diagnosis: z.string().min(3, "Diagnosis must be at least 3 characters"),
    recommendations: z.string().optional(),
});

type MedicalFormData = z.infer<typeof medicalSchema>;

interface MedicalFormProps {
    onSubmit: (data: MedicalFormData) => void;
    isSubmitting?: boolean;
}

export function MedicalForm({ onSubmit, isSubmitting }: MedicalFormProps) {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<MedicalFormData>({
        resolver: zodResolver(medicalSchema),
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <Stethoscope className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Medical Visit Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="doctor">Doctor Name*</Label>
                    <Input
                        id="doctor"
                        {...register("doctor")}
                        placeholder="e.g. Dr. House"
                        className={errors.doctor ? "border-red-500" : ""}
                    />
                    {errors.doctor && (
                        <p className="text-xs text-red-500">{errors.doctor.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="specialization">Specialization</Label>
                    <Input
                        id="specialization"
                        {...register("specialization")}
                        placeholder="e.g. Pediatrician"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="diagnosis">Diagnosis*</Label>
                <Input
                    id="diagnosis"
                    {...register("diagnosis")}
                    placeholder="What was the outcome?"
                    className={errors.diagnosis ? "border-red-500" : ""}
                />
                {errors.diagnosis && (
                    <p className="text-xs text-red-500">{errors.diagnosis.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="recommendations">Recommendations</Label>
                <Textarea
                    id="recommendations"
                    {...register("recommendations")}
                    placeholder="Rest, meds, follow-up..."
                    className="min-h-[100px]"
                />
            </div>

            <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={isSubmitting}
                data-testid="submit-medical"
            >
                {isSubmitting ? "Adding..." : "Add Medical Visit"}
            </Button>
        </form>
    );
}
