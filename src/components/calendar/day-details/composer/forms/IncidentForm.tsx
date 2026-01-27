import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { Controller } from "react-hook-form";

const incidentSchema = z.object({
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    description: z.string().min(1, "Description is required"),
});

type IncidentFormData = z.infer<typeof incidentSchema>;

interface IncidentFormProps {
    onSubmit: (data: IncidentFormData) => void;
    isSubmitting?: boolean;
}

export function IncidentForm({ onSubmit, isSubmitting }: IncidentFormProps) {
    const {
        handleSubmit,
        control,
        register,
        formState: { errors },
    } = useForm<IncidentFormData>({
        resolver: zodResolver(incidentSchema),
        defaultValues: {
            severity: "LOW",
        },
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Incident Report</h3>
            </div>

            <div className="space-y-2">
                <Label>Severity*</Label>
                <Controller
                    name="severity"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LOW">Low</SelectItem>
                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                <SelectItem value="HIGH">High</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description*</Label>
                <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Describe what happened..."
                    className={errors.description ? "border-red-500" : ""}
                />
                {errors.description && (
                    <p className="text-xs text-red-500">{errors.description.message}</p>
                )}
            </div>

            <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={isSubmitting}
                data-testid="submit-incident"
            >
                {isSubmitting ? "Adding..." : "Add Incident"}
            </Button>
        </form>
    );
}
