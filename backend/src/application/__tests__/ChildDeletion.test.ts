import { describe, it, expect, beforeEach } from "vitest";
import { ChildService } from "../ChildService";
import { InMemoryChildRepository } from "../../adapters/secondary/InMemoryChildRepository";
import { InMemoryTimelineRepository } from "../../adapters/secondary/InMemoryTimelineRepository";
import { Child } from "../../core/domain/child/Child";
import { CreateTimelineItemDto } from "../../core/domain/TimelineItem";
import { TimelineServiceImpl } from "../TimelineService";

describe("Child Management Service Enhancements", () => {
    let childService: ChildService;
    let timelineService: TimelineServiceImpl;
    let childRepo: InMemoryChildRepository;
    let timelineRepo: InMemoryTimelineRepository;

    beforeEach(() => {
        childRepo = new InMemoryChildRepository();
        timelineRepo = new InMemoryTimelineRepository();
        childService = new ChildService(childRepo, timelineRepo);
        timelineService = new TimelineServiceImpl(timelineRepo);
    });

    it("should update child color correctly", async () => {
        const child = await childService.addChild({ name: "Alice", color: "#FF0000", icon: "user" });

        const updated = await childService.updateChild(child.id, { color: "#00FF00" });

        expect(updated.color).toBe("#00FF00");
        const found = await childRepo.findById(child.id);
        expect(found?.color).toBe("#00FF00");
    });

    it("should prevent deletion of a child if they have linked timeline items", async () => {
        // 1. Add a child
        const child = await childService.addChild({ name: "Zoe", color: "#800080", icon: "user" });

        // 2. Create a timeline item linked to this child
        const dto: CreateTimelineItemDto = {
            type: "NOTE",
            date: "2026-02-03",
            createdBy: "user-1",
            content: "Notes for Zoe",
            childIds: [child.id],
        } as CreateTimelineItemDto;
        await timelineService.createItem(dto);

        // 3. Try to delete the child - should throw
        await expect(childService.deleteChild(child.id)).rejects.toThrow("Cannot delete child: 1 timeline items are linked to this profile.");

        // 4. Verify child still exists
        const found = await childRepo.findById(child.id);
        expect(found).not.toBeNull();
    });

    it("should allow deletion of a child if they have NO linked timeline items", async () => {
        const child = await childService.addChild({ name: "Bob", color: "#0000FF", icon: "user" });

        await childService.deleteChild(child.id);

        const found = await childRepo.findById(child.id);
        expect(found).toBeNull();
    });
});
