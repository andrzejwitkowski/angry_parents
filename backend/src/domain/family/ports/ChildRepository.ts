import { Child } from "../model/Child";

export interface ChildRepository {
    save(child: Child): Promise<Child>;
    findAllByFamilyId(familyId: string): Promise<Child[]>;
    findById(id: string): Promise<Child | null>;
    delete(id: string): Promise<void>;
}
