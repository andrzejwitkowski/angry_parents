import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "lucide-react";
import { ChildSelector } from "../components/ChildSelector";

const medsSchema = z.object({
    medicineName: z.string().min(1, "Medicine name is required"),
    dosage: z.string().min(1, "Dosage is required"),
    childIds: z.array(z.string()),
});

type MedsFormData = z.infer<typeof medsSchema>;

interface MedsFormProps {
    initialData?: MedsFormData;
    onSubmit: (data: MedsFormData) => void;
    isSubmitting?: boolean;
}

export function MedsForm({ initialData, onSubmit, isSubmitting }: MedsFormProps) {
    const { t } = useTranslation();
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<MedsFormData>({
        resolver: zodResolver(medsSchema),
        defaultValues: {
            medicineName: initialData?.medicineName || "",
            dosage: initialData?.dosage || "",
            childIds: initialData?.childIds || [],
        },
    });

    // eslint-disable-next-line react-hooks/incompatible-library
    const selectedChildIds = watch("childIds");

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Pill className="w-5 h-5" />
                <h3 className="font-semibold text-lg">{t("meds.details")}</h3>
            </div>

            <ChildSelector
                selectedIds={selectedChildIds}
                onChange={(ids) => setValue("childIds", ids, { shouldValidate: true })}
            />

            <div className="space-y-2">
                <Label htmlFor="medicineName">{t("meds.medicineNameLabel")}*</Label>
                <Input
                    id="medicineName"
                    {...register("medicineName")}
                    placeholder={t("meds.medicineNamePlaceholder")}
                    className={errors.medicineName ? "border-red-500" : ""}
                />
                {errors.medicineName && (
                    <p className="text-xs text-red-500">{errors.medicineName.message}</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="dosage">{t("meds.dosageLabel")}*</Label>
                <Input
                    id="dosage"
                    {...register("dosage")}
                    placeholder={t("meds.dosagePlaceholder")}
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
                {isSubmitting ? (initialData ? t("meds.saving") : t("meds.adding")) : (initialData ? t("meds.updateSubmit") : t("meds.addSubmit"))}
            </Button>
        </form>
    );
}
