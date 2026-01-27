import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft } from "lucide-react";
import { Controller } from "react-hook-form";

const handoverSchema = z.object({
    location: z.string().min(1, "Location is required"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
    status: z.enum(["PENDING", "COMPLETED"]),
});

type HandoverFormData = z.infer<typeof handoverSchema>;

interface HandoverFormProps {
    onSubmit: (data: HandoverFormData) => void;
    isSubmitting?: boolean;
}

export function HandoverForm({ onSubmit, isSubmitting }: HandoverFormProps) {
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<HandoverFormData>({
        resolver: zodResolver(handoverSchema),
        defaultValues: {
            status: "PENDING",
        },
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <ArrowRightLeft className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Handover Details</h3>
            </div>

            <div className="space-y-2">
                <Label htmlFor="location">Location*</Label>
                <Input
                    id="location"
                    {...register("location")}
                    placeholder="e.g. School, Home, Park"
                    className={errors.location ? "border-red-500" : ""}
                />
                {errors.location && (
                    <p className="text-xs text-red-500">{errors.location.message}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="time">Time (HH:MM)*</Label>
                    <Input
                        id="time"
                        {...register("time")}
                        placeholder="e.g. 15:30"
                        className={errors.time ? "border-red-500" : ""}
                    />
                    {errors.time && (
                        <p className="text-xs text-red-500">{errors.time.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Status*</Label>
                    <Controller
                        name="status"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            </div>

            <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={isSubmitting}
                data-testid="submit-handover"
            >
                {isSubmitting ? "Adding..." : "Add Handover"}
            </Button>
        </form>
    );
}
