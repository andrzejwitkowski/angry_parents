import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";
import { CustodyStrategy } from "./CustodyStrategy";
import { TimeUtils } from "../TimeUtils";
import { UuidProvider } from "../../../ports/UuidProvider";

type ParentRole = 'MOM' | 'DAD';
type TimeAssignment = { start: string, end: string, parent: ParentRole };

export class CustomBlockStrategy implements CustodyStrategy {
    generate(config: CustodyPatternConfig, uuidProvider: UuidProvider): CustodyEntry[] {
        const entries: CustodyEntry[] = [];
        const dates = TimeUtils.getDatesInRange(config.startDate, config.endDate);

        const repeatInterval = config.customBlockRepeatInterval || 1;
        const repeatUnit = config.customBlockRepeatUnit || 'WEEKS';
        const intervalDays = repeatUnit === 'WEEKS' ? repeatInterval * 7 : repeatInterval;
        const anchorDate = config.anchorDate || config.startDate;

        const startDayOffset = this.calculateStartDayOffset(config.customBlockStartDay, anchorDate);

        dates.forEach(date => {
            const diffDays = this.calculateDiffDays(date, anchorDate);

            if (diffDays < 0) {
                // Before pattern starts
                const otherParent = this.getOtherParent(config.startingParent);
                this.addAssignmentsToEntries([{ start: "00:00", end: "23:59", parent: otherParent }], date, config, uuidProvider, entries);
                return;
            }

            const cycleDay = diffDays % intervalDays;
            const adjustedCycleDay = (cycleDay - startDayOffset + intervalDays) % intervalDays;

            const assignments = this.getAssignmentsForCycleDay(adjustedCycleDay, config);
            this.addAssignmentsToEntries(assignments, date, config, uuidProvider, entries);
        });

        return entries;
    }

    private calculateStartDayOffset(customBlockStartDay: number | undefined, anchorDate: string): number {
        if (customBlockStartDay === undefined) {
            return 0;
        }
        const anchorD = new Date(anchorDate + "T00:00:00");
        const anchorDayOfWeek = anchorD.getDay(); // 0-6 (Sun-Sat)
        return (customBlockStartDay - anchorDayOfWeek + 7) % 7;
    }

    private calculateDiffDays(date: string, anchorDate: string): number {
        const start = new Date(anchorDate + "T00:00:00");
        const current = new Date(date + "T00:00:00");
        const diffTime = current.getTime() - start.getTime();
        return Math.round(diffTime / (1000 * 60 * 60 * 24));
    }

    private getOtherParent(parent: ParentRole): ParentRole {
        return parent === 'MOM' ? 'DAD' : 'MOM';
    }

    private getAssignmentsForCycleDay(adjustedCycleDay: number, config: CustodyPatternConfig): TimeAssignment[] {
        const blockParent = config.startingParent;
        const otherParent = this.getOtherParent(blockParent);

        const handoverTime = config.handoverTime || "17:00";
        const returnTime = config.handoverEndTime || "09:00";
        const blockEndDayOffset = config.customBlockEndDayOffset || 1;

        if (this.isSingleDayBlock(adjustedCycleDay, blockEndDayOffset)) {
            return [
                { start: "00:00", end: handoverTime, parent: otherParent },
                { start: handoverTime, end: returnTime, parent: blockParent },
                { start: returnTime, end: "23:59", parent: otherParent }
            ];
        }

        if (this.isBlockStartDay(adjustedCycleDay)) {
            return [
                { start: "00:00", end: handoverTime, parent: otherParent },
                { start: handoverTime, end: "23:59", parent: blockParent }
            ];
        }

        if (this.isBlockEndDay(adjustedCycleDay, blockEndDayOffset)) {
            return [
                { start: "00:00", end: returnTime, parent: blockParent },
                { start: returnTime, end: "23:59", parent: otherParent }
            ];
        }

        if (this.isMiddleOfBlock(adjustedCycleDay, blockEndDayOffset)) {
            return [
                { start: "00:00", end: "23:59", parent: blockParent }
            ];
        }

        // Outside the block entirely
        return [
            { start: "00:00", end: "23:59", parent: otherParent }
        ];
    }

    private isSingleDayBlock(adjustedCycleDay: number, blockEndDayOffset: number): boolean {
        return adjustedCycleDay === 0 && adjustedCycleDay === blockEndDayOffset;
    }

    private isBlockStartDay(adjustedCycleDay: number): boolean {
        return adjustedCycleDay === 0;
    }

    private isBlockEndDay(adjustedCycleDay: number, blockEndDayOffset: number): boolean {
        return adjustedCycleDay === blockEndDayOffset;
    }

    private isMiddleOfBlock(adjustedCycleDay: number, blockEndDayOffset: number): boolean {
        return adjustedCycleDay > 0 && adjustedCycleDay < blockEndDayOffset;
    }

    private addAssignmentsToEntries(
        assignments: TimeAssignment[],
        date: string,
        config: CustodyPatternConfig,
        uuidProvider: UuidProvider,
        entries: CustodyEntry[]
    ): void {
        const validAssignments = assignments.filter(a => a.start !== a.end);

        validAssignments.forEach((assign) => {
            entries.push({
                id: uuidProvider.generate(),
                childId: config.childId,
                date: date,
                startTime: assign.start,
                endTime: assign.end,
                assignedTo: assign.parent,
                isRecurring: true,
                priority: 0
            });
        });
    }
}
