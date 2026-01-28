export class TimeUtils {
    static getDatesInRange(startDate: string, endDate: string): string[] {
        const dates: string[] = [];
        let current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    static getDayOfWeek(date: string): number {
        // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        return new Date(date).getDay();
    }

    static addDays(date: string, days: number): string {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }
}
