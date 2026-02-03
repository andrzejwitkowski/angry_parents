import { Child } from "../core/domain/child/Child";
import { ChildRepository } from "../core/ports/ChildRepository";
import { TimelineRepository } from "../core/ports/TimelineRepository";

export class ChildService {
    constructor(
        private childRepository: ChildRepository,
        private timelineRepository: TimelineRepository
    ) { }

    async getAllChildren(): Promise<Child[]> {
        return await this.childRepository.findAll();
    }

    async addChild(child: Omit<Child, "id">): Promise<Child> {
        const newChild: Child = {
            ...child,
            id: crypto.randomUUID()
        };
        return await this.childRepository.save(newChild);
    }

    async updateChild(id: string, updates: Partial<Child>): Promise<Child> {
        const existing = await this.childRepository.findById(id);
        if (!existing) {
            throw new Error(`Child with id ${id} not found`);
        }

        const updated = { ...existing, ...updates };
        return await this.childRepository.save(updated);
    }

    async deleteChild(id: string): Promise<void> {
        const itemCount = await this.timelineRepository.countByChildId(id);
        if (itemCount > 0) {
            throw new Error(`Cannot delete child: ${itemCount} timeline items are linked to this profile.`);
        }
        await this.childRepository.delete(id);
    }
}
