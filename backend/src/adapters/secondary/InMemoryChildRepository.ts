import { Child } from "../../core/domain/child/Child";
import { ChildRepository } from "../../core/ports/ChildRepository";

export class InMemoryChildRepository implements ChildRepository {
    private children: Map<string, Child> = new Map();

    async save(child: Child): Promise<Child> {
        this.children.set(child.id, { ...child });
        return child;
    }

    async findAll(): Promise<Child[]> {
        return Array.from(this.children.values());
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
