import { CustodyPatternConfig } from "../core/domain/child/CustodyPatternConfig";
import { CustodyEntry } from "../core/domain/child/CustodyEntry";
import { AlternatingWeekendStrategy } from "../core/domain/child/strategies/AlternatingWeekendStrategy";
import { TwoTwoThreeStrategy } from "../core/domain/child/strategies/TwoTwoThreeStrategy";
import { HolidayStrategy } from "../core/domain/child/strategies/HolidayStrategy";

import { CustomSequenceStrategy } from "../core/domain/child/strategies/CustomSequenceStrategy";
import { GapFillStrategy } from "../core/domain/child/strategies/GapFillStrategy";
import { UuidProvider } from "../core/ports/UuidProvider";

export class CustodyGenerator {
    constructor(private readonly uuidProvider: UuidProvider) { }

    generate(config: CustodyPatternConfig): CustodyEntry[] {
        let entries: CustodyEntry[] = [];

        if (config.type === 'ALTERNATING_WEEKEND') {
            const strategy = new AlternatingWeekendStrategy();
            entries = strategy.generate(config, this.uuidProvider);
        } else if (config.type === 'TWO_TWO_THREE') {
            const strategy = new TwoTwoThreeStrategy();
            entries = strategy.generate(config, this.uuidProvider);
        } else if (config.type === 'CUSTOM_SEQUENCE' && config.sequence) {
            const strategy = new CustomSequenceStrategy();
            entries = strategy.generate(config, this.uuidProvider);
        } else if (config.type === 'HOLIDAY') {
            const strategy = new HolidayStrategy();
            entries = strategy.generate(config, this.uuidProvider);
        } else if (config.type === 'GAP_FILL') {
            const strategy = new GapFillStrategy();
            entries = strategy.generate(config, this.uuidProvider);
        }

        return entries;
    }
}
