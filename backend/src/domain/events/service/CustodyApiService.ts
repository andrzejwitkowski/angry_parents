import { startOfMonth, endOfMonth, parseISO, format, eachDayOfInterval, subDays, addDays } from "date-fns";
import { CustodyGenerator } from "./CustodyGenerator";
import { ScheduleService } from "./ScheduleService";
import { PropagationService } from "./PropagationService";
import { CustodyPatternConfig } from "../model/child/CustodyPatternConfig";
import { CustodyEntry } from "../model/child/CustodyEntry";
import { CustodyRepository } from "../ports/CustodyRepository";
import { UuidProvider } from "../../shared/ports/UuidProvider";

export class CustodyApiService {
    constructor(
        private readonly custodyRepository: CustodyRepository,
        private readonly scheduleService: ScheduleService,
        private readonly propagationService: PropagationService,
        private readonly uuidProvider: UuidProvider
    ) { }

    preview(config: CustodyPatternConfig) {
        const generator = new CustodyGenerator(this.uuidProvider);
        return generator.generate(config);
    }

    async saveEntries(entries: CustodyEntry[]) {
        await this.custodyRepository.save(entries);
        return { success: true, count: entries.length };
    }

    async getResolvedCalendar(query: { start: string; end: string; childId?: string }) {
        const { start, end, childId } = query;
        if (!start || !end) {
            const error = new Error("Missing start or end date");
            (error as any).status = 400;
            throw error;
        }
        return this.scheduleService.getResolvedCalendar(childId, start, end);
    }

    async createRule(config: CustodyPatternConfig) {
        const rule = await this.scheduleService.createRule(config);
        return { success: true, ruleId: rule.id };
    }

    async getRules(childId?: string) {
        if (!childId) {
            const error = new Error("Missing childId");
            (error as any).status = 400;
            throw error;
        }
        return this.scheduleService.getRulesByChild(childId);
    }

    async deleteRule(id: string) {
        await this.scheduleService.deleteRule(id);
        return { success: true };
    }

    async reorderRule(id: string, direction: "UP" | "DOWN") {
        await this.scheduleService.reorderRule(id, direction);
        return { success: true };
    }

    async checkConflicts(config: CustodyPatternConfig, excludeRuleId?: string) {
        const conflicts = await this.scheduleService.checkConflicts(config as any, excludeRuleId);
        return { conflicts };
    }

    async fillGaps(body: { childId: string; parent: "MOM" | "DAD"; monthDate: string }) {
        const { childId, parent, monthDate } = body;

        await this.scheduleService.deleteGapFillRulesByChild(childId);

        const monthStart = startOfMonth(parseISO(monthDate));
        const monthEnd = endOfMonth(parseISO(monthDate));
        const bufferStart = subDays(monthStart, 1);
        const bufferEnd = addDays(monthEnd, 1);

        const entries = await this.scheduleService.getResolvedCalendar(
            childId,
            format(bufferStart, "yyyy-MM-dd"),
            format(bufferEnd, "yyyy-MM-dd")
        );

        const entryMap = new Map<string, CustodyEntry>();
        entries.forEach(e => entryMap.set(e.date, e));

        const daysOfMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const gaps: string[] = [];
        for (const day of daysOfMonth) {
            const dateStr = format(day, "yyyy-MM-dd");
            if (!entryMap.has(dateStr)) gaps.push(dateStr);
        }

        if (gaps.length === 0) {
            return { success: true, count: 0, message: "No gaps found" };
        }

        const spans: string[][] = [];
        let currentSpan: string[] = [];

        for (let i = 0; i < gaps.length; i++) {
            const date = gaps[i];
            if (currentSpan.length === 0) {
                currentSpan.push(date);
                continue;
            }

            const lastDate = parseISO(currentSpan[currentSpan.length - 1]);
            const currentDate = parseISO(date);
            const diff = currentDate.getTime() - lastDate.getTime();
            const oneDay = 1000 * 60 * 60 * 24;

            if (diff <= oneDay + 1000) {
                currentSpan.push(date);
            } else {
                spans.push(currentSpan);
                currentSpan = [date];
            }
        }
        if (currentSpan.length > 0) spans.push(currentSpan);

        const ruleIds: string[] = [];
        for (const span of spans) {
            const spanStartDate = parseISO(span[0]);
            const spanEndDate = parseISO(span[span.length - 1]);

            const dayBeforeStr = format(subDays(spanStartDate, 1), "yyyy-MM-dd");
            const dayAfterStr = format(addDays(spanEndDate, 1), "yyyy-MM-dd");

            const anchorBefore = entryMap.get(dayBeforeStr)?.sourceRuleId;
            const anchorAfter = entryMap.get(dayAfterStr)?.sourceRuleId;

            const config: CustodyPatternConfig = {
                childId,
                startDate: span[0],
                endDate: span[span.length - 1],
                type: "GAP_FILL",
                startingParent: parent,
                anchorBeforeRuleId: anchorBefore,
                anchorAfterRuleId: anchorAfter
            };

            const rule = await this.scheduleService.createRule(config);
            ruleIds.push(rule.id);
        }

        return { success: true, count: ruleIds.length, ruleIds };
    }

    async propagateDryRun(body: { childId: string; currentMonthDate: string }) {
        return this.propagationService.simulatePropagation(body.childId, body.currentMonthDate);
    }

    async propagate(body: { rulesToCreate: CustodyPatternConfig[] }) {
        const createdRules: CustodyPatternConfig[] = [];
        for (const config of body.rulesToCreate) {
            const rule = await this.scheduleService.createRule(config as CustodyPatternConfig);
            createdRules.push(rule.config);
        }
        return { success: true, count: createdRules.length };
    }
}
