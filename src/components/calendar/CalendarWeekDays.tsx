import { useTranslation } from "react-i18next";
import { enUS, pl } from "date-fns/locale";

export function CalendarWeekDays() {
    const { i18n } = useTranslation();
    const currentLocale = i18n.language === 'pl' ? pl : enUS;

    const weekDays = ([0, 1, 2, 3, 4, 5, 6] as const).map(d =>
        currentLocale.localize?.day(d, { width: 'abbreviated' })
    );

    return (
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {weekDays.map((day, i) => (
                <div
                    key={i}
                    className="py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest"
                >
                    {day}
                </div>
            ))}
        </div>
    );
}
