import { CustodyPatternConfig } from "../core/domain/child/CustodyPatternConfig";
import { CustodyEntry } from "../core/domain/child/CustodyEntry";
import { AlternatingWeekendStrategy } from "../core/domain/child/strategies/AlternatingWeekendStrategy";
import { TwoTwoThreeStrategy } from "../core/domain/child/strategies/TwoTwoThreeStrategy";
import { HolidayStrategy } from "../core/domain/child/strategies/HolidayStrategy";

export class CustodyGenerator {
    generate(config: CustodyPatternConfig): CustodyEntry[] {
        let entries: CustodyEntry[] = [];

        if (config.type === 'ALTERNATING_WEEKEND') {
            const strategy = new AlternatingWeekendStrategy();
            entries = strategy.generate(config);
        } else if (config.type === 'CUSTOM_SEQUENCE' && config.sequence) {
            const strategy = new TwoTwoThreeStrategy(); // Simplify: assume generic custom is 2-2-3 for now or map properly
            entries = strategy.generate(config);
        } else if (config.type === 'HOLIDAY') {
            const strategy = new HolidayStrategy();
            entries = strategy.generate(config);
        }

        return entries;
    }
}
