import { CustodyEntry } from "../domain/child/CustodyEntry";

export interface CustodyRepository {
    save(entries: CustodyEntry[]): Promise<void>;
    findByDateRange(childId: string | undefined, startDate: string, endDate: string): Promise<CustodyEntry[]>;
    deleteAll(): Promise<void>; // Useful for testing
}
