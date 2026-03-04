import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { Controller } from "react-hook-form";
import { ChildSelector } from "../components/ChildSelector";

const incidentSchema = z.object({
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    description: z.string().min(1, "Description is required"),
    childIds: z.array(z.string()),
});

type IncidentFormData = z.infer<typeof incidentSchema>;

interface IncidentFormProps {
    initialData?: Partial<IncidentFormData>;
    onSubmit: (data: IncidentFormData) => void;
    isSubmitting?: boolean;
}

export function IncidentForm({ initialData, onSubmit, isSubmitting }: IncidentFormProps) {
    const { t } = useTranslation();
    const {
        handleSubmit,
        control,
        setValue,
        watch,
        register,
        formState: { errors },
    } = useForm<IncidentFormData>({
        resolver: zodResolver(incidentSchema),
        defaultValues: {
            severity: initialData?.severity || "LOW",
            description: initialData?.description || "",
            childIds: initialData?.childIds || [],
        },
    });

    // eslint-disable-next-line react-hooks/incompatible-library
    const selectedChildIds = watch("childIds");

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-semibold text-lg">{t("incident.details")}</h3>
            </div>

            <ChildSelector
                selectedIds={selectedChildIds}
                onChange={(ids) => setValue("childIds", ids, { shouldValidate: true })}
            />

            <div className="space-y-2">
                <Label>{t("incident.severityLabel")}*</Label>
                <Controller
                    name="severity"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder={t("incident.severityPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LOW">{t("incident.severityLow")}</SelectItem>
                                <SelectItem value="MEDIUM">{t("incident.severityMedium")}</SelectItem>
                                <SelectItem value="HIGH">{t("incident.severityHigh")}</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">{t("incident.descriptionLabel")}*</Label>
                <Textarea
                    id="description"
                    {...register("description")}
                    placeholder={t("incident.descriptionPlaceholder")}
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
                {isSubmitting ? (initialData ? t("incident.saving") : t("incident.adding")) : (initialData ? t("incident.updateSubmit") : t("incident.addSubmit"))}
            </Button>
        </form>
    );
}
