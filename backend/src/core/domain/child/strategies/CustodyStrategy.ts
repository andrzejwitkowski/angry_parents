import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";

export interface CustodyStrategy {
    generate(config: CustodyPatternConfig): CustodyEntry[];
}
