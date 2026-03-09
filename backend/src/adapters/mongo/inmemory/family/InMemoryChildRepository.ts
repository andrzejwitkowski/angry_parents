import { Child } from "../../../../domain/family/model/Child";
import { ChildRepository } from "../../../../domain/family/ports/ChildRepository";

export class InMemoryChildRepository implements ChildRepository {
    private childrenByFamily: Map<string, Child[]> = new Map();

    async save(child: Child): Promise<Child> {
        if (!child.familyId) {
            throw new Error("Child familyId is required");
        }

        const familyChildren = this.childrenByFamily.get(child.familyId) ?? [];
        const existingIndex = familyChildren.findIndex(existing => existing.id === child.id);
        const copy = { ...child };
        if (existingIndex >= 0) {
            familyChildren[existingIndex] = copy;
        } else {
            familyChildren.push(copy);
        }
        this.childrenByFamily.set(child.familyId, familyChildren);
        return child;
    }

    async findAll(): Promise<Child[]> {
        return Array.from(this.childrenByFamily.values()).flat();
    }

    async findAllByFamilyId(familyId: string): Promise<Child[]> {
        return [...(this.childrenByFamily.get(familyId) ?? [])];
    }

    async findById(id: string): Promise<Child | null> {
        for (const children of this.childrenByFamily.values()) {
            const child = children.find(existing => existing.id === id);
            if (child) {
                return child;
            }
        }
        return null;
    }

    async delete(id: string): Promise<void> {
        for (const [familyId, children] of this.childrenByFamily.entries()) {
            const nextChildren = children.filter(child => child.id !== id);
            if (nextChildren.length !== children.length) {
                this.childrenByFamily.set(familyId, nextChildren);
                return;
            }
        }
    }

    clear(): void {
        this.childrenByFamily.clear();
    }
}
