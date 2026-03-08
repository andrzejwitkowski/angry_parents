import { CustodyPatternConfig } from "../model/child/CustodyPatternConfig";
import { CustodyEntry } from "../model/child/CustodyEntry";
import { AlternatingWeekendStrategy } from "../model/child/strategies/AlternatingWeekendStrategy";
import { CustomBlockStrategy } from "../model/child/strategies/CustomBlockStrategy";
import { HolidayStrategy } from "../model/child/strategies/HolidayStrategy";

import { CustomSequenceStrategy } from "../model/child/strategies/CustomSequenceStrategy";
import { GapFillStrategy } from "../model/child/strategies/GapFillStrategy";
import { UuidProvider } from "../../shared/ports/UuidProvider";

export class CustodyGenerator {
    constructor(private readonly uuidProvider: UuidProvider) { }

    generate(config: CustodyPatternConfig): CustodyEntry[] {
        let entries: CustodyEntry[] = [];

        if (config.type === 'ALTERNATING_WEEKEND') {
            const strategy = new AlternatingWeekendStrategy();
            entries = strategy.generate(config, this.uuidProvider);
        } else if (config.type === 'CUSTOM_BLOCK') {
            const strategy = new CustomBlockStrategy();
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
