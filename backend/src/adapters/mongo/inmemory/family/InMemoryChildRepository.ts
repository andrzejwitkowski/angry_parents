import { Child } from "../../../../domain/family/model/Child";
import { ChildRepository } from "../../../../domain/family/ports/ChildRepository";

export class InMemoryChildRepository implements ChildRepository {
    private children: Map<string, Child> = new Map();

    async save(child: Child): Promise<Child> {
        this.children.set(child.id, { ...child });
        return child;
    }

    async findAll(): Promise<Child[]> {
        return Array.from(this.children.values());
    }

    async findAllByFamilyId(familyId: string): Promise<Child[]> {
        return Array.from(this.children.values()).filter(c => c.familyId === familyId);
    }

    async findById(id: string): Promise<Child | null> {
        return this.children.get(id) || null;
    }

    async delete(id: string): Promise<void> {
        this.children.delete(id);
    }

    clear(): void {
        this.children.clear();
    }
}
