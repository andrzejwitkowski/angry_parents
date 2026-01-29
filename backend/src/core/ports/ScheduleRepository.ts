import { ScheduleRule } from "../domain/child/ScheduleRule";

export interface ScheduleRepository {
    save(rule: ScheduleRule): Promise<void>;
    findById(id: string): Promise<ScheduleRule | null>;
    findAllByChildId(childId: string): Promise<ScheduleRule[]>;
    delete(id: string): Promise<void>;
}
