import { CustodyEntry } from "../CustodyEntry";
import { CustodyPatternConfig } from "../CustodyPatternConfig";
import { UuidProvider } from "../../../../shared/ports/UuidProvider";

export interface CustodyStrategy {
    generate(config: CustodyPatternConfig, uuidProvider: UuidProvider): CustodyEntry[];
}
