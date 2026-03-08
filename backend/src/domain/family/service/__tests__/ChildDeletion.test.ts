import { describe, it, expect, beforeEach } from "vitest";
import { ChildService } from "../ChildService";
import { InMemoryChildRepository } from "../../../../adapters/mongo/inmemory/family/InMemoryChildRepository";
import { InMemoryTimelineRepository } from "../../../../adapters/mongo/inmemory/events/InMemoryTimelineRepository";
// import { Child } from "../../model/Child";
import { CreateTimelineItemDto } from "../../../events/model/TimelineItem";
import { TimelineServiceImpl } from "../../../events/service/TimelineService";
import { RealDateProvider } from "../../../../shared/providers/RealDateProvider";
import { RealUuidProvider } from "../../../../shared/providers/RealUuidProvider";

describe("Child Management Service Enhancements", () => {
    let childService: ChildService;
    let childRepo: InMemoryChildRepository;
    let timelineRepo: InMemoryTimelineRepository;

    let uuidProvider: RealUuidProvider;
    let dateProvider: RealDateProvider;

    beforeEach(() => {
        dateProvider = new RealDateProvider();
        uuidProvider = new RealUuidProvider();
        childRepo = new InMemoryChildRepository();
        timelineRepo = new InMemoryTimelineRepository();
        childService = new ChildService(childRepo, timelineRepo, uuidProvider);
    });

    it("should update child color correctly", async () => {
        const child = await childService.addChild("family-1", { name: "Alice", color: "#FF0000", icon: "user" });

        const updated = await childService.updateChild(child.id, { color: "#00FF00" });

        expect(updated.color).toBe("#00FF00");
        const found = await childRepo.findById(child.id);
        expect(found?.color).toBe("#00FF00");
    });

    it("should prevent deletion of a child if they have linked timeline items", async () => {
        // 1. Add a child
        const child = await childService.addChild("family-1", { name: "Zoe", color: "#800080", icon: "user" });

        // 2. Create a timeline item linked to this child
        await timelineRepo.save({
            id: uuidProvider.generate(),
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "user-1",
            createdAt: dateProvider.getIsoString(),
            childIds: [child.id],
            auditTrail: [],
            isDeleted: false,
            encryptedPayload: { "user-mom": "x", "user-dad": "y" }
        } as any);

        // 3. Try to delete the child - should throw
        await expect(childService.deleteChild(child.id)).rejects.toThrow("Cannot delete child: 1 timeline items are linked to this profile.");

        // 4. Verify child still exists
        const found = await childRepo.findById(child.id);
        expect(found).not.toBeNull();
    });

    it("should allow deletion of a child if they have NO linked timeline items", async () => {
        const child = await childService.addChild("family-1", { name: "Bob", color: "#0000FF", icon: "user" });

        await childService.deleteChild(child.id);

        const found = await childRepo.findById(child.id);
        expect(found).toBeNull();
    });
});
