import { Child } from "../core/domain/child/Child";
import { ChildRepository } from "../core/ports/ChildRepository";
import { TimelineRepository } from "../core/ports/TimelineRepository";
import { UuidProvider } from "../core/ports/UuidProvider";

export class ChildService {
    constructor(
        private childRepository: ChildRepository,
        private timelineRepository: TimelineRepository,
        private uuidProvider: UuidProvider
    ) { }

    async getAllChildren(familyId: string): Promise<Child[]> {
        return await this.childRepository.findAllByFamilyId(familyId);
    }

    async addChild(familyId: string, child: Omit<Child, "id" | "familyId">): Promise<Child> {
        const newChild: Child = {
            ...child,
            id: this.uuidProvider.generate(),
            familyId
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
