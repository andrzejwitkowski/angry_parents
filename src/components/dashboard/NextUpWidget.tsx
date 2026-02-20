import { useTranslation } from "react-i18next";
import { ArrowRight, MapPin, Stethoscope, Pill, CalendarOff } from "lucide-react";
import type { UpcomingActivityType } from "@/hooks/useUpcomingActivity";
import type { HandoverItem, MedicalVisitItem, MedsItem } from "@/types/timeline.types";
import { useUpcomingActivity } from "@/hooks/useUpcomingActivity";

// ── Sub-components ──────────────────────────────────────────────────────────

function LoadingState() {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-3 text-slate-400">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-400 rounded-full animate-spin" />
            <span className="text-sm font-medium">{t("dashboard.loading")}</span>
        </div>
    );
}

function EmptyState() {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-4" data-testid="next-up-empty">
            <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-300 shrink-0">
                <CalendarOff className="w-7 h-7" />
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">
                {t("dashboard.noActivity")}
            </p>
        </div>
    );
}

function HandoverActivity({ item }: { item: HandoverItem }) {
    const { t } = useTranslation();
    // Custody-schedule-derived handovers carry `assignedTo`, manual ones have `location`
    const withParent = item as HandoverItem & { assignedTo?: "MOM" | "DAD" };
    const subtitle = item.location || (withParent.assignedTo
        ? t("dashboard.handoverTo", { parent: t(`scheduler.${withParent.assignedTo.toLowerCase()}_genitive`) })
        : null);

    return (
        <div className="flex items-center gap-4" data-testid="next-up-handover">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                {withParent.assignedTo ? <ArrowRight className="w-7 h-7" /> : <MapPin className="w-7 h-7" />}
            </div>
            <div className="space-y-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {t("dashboard.handoverAt", { time: item.time })}
                </h3>
                {subtitle && (
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium truncate">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}

function MedicalActivity({ item }: { item: MedicalVisitItem }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-4" data-testid="next-up-medical">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Stethoscope className="w-7 h-7" />
            </div>
            <div className="space-y-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {t("dashboard.doctorVisit", { doctor: item.doctor })}
                </h3>
                {item.specialization && (
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium truncate">
                        {item.specialization}
                    </p>
                )}
            </div>
        </div>
    );
}

function MedsActivity({ item }: { item: MedsItem }) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-4" data-testid="next-up-meds">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Pill className="w-7 h-7" />
            </div>
            <div className="space-y-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {t("dashboard.medsAt", { name: item.medicineName })}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium truncate">
                    {item.dosage}
                </p>
            </div>
        </div>
    );
}

function ActivityContent({ activity }: { activity: UpcomingActivityType }) {
    switch (activity.type) {
        case "HANDOVER": return <HandoverActivity item={activity} />;
        case "MEDICAL_VISIT": return <MedicalActivity item={activity} />;
        case "MEDS": return <MedsActivity item={activity} />;
    }
}

// ── Main export ─────────────────────────────────────────────────────────────

interface NextUpWidgetProps {
    refreshKey?: number;
}

export function NextUpWidget({ refreshKey }: NextUpWidgetProps) {
    const { t } = useTranslation();
    const { nextActivity, isLoading } = useUpcomingActivity(refreshKey);

    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 h-[120px] relative overflow-hidden flex items-center">
            {/* Badge */}
            <div className="absolute top-0 right-0 p-3">
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-full">
                    {t("dashboard.nextUp")}
                </span>
            </div>

            {/* Content */}
            <div className="relative z-10 w-full">
                {isLoading
                    ? <LoadingState />
                    : nextActivity
                        ? <ActivityContent activity={nextActivity} />
                        : <EmptyState />}
            </div>
        </div>
    );
}
