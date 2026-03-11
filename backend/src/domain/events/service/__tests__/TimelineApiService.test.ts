import { describe, expect, it, vi } from "vitest";
import { TimelineApiService } from "../TimelineApiService";

describe("TimelineApiService", () => {
    it("checks child ownership in parallel and still reports infrastructure lookup failures", async () => {
        const startedLookups: string[] = [];

        const childRepository = {
            findById: vi.fn()
                .mockImplementation(async (childId: string) => {
                    startedLookups.push(childId);

                    if (childId === "child-1") {
                        await new Promise((resolve) => setTimeout(resolve, 20));
                        return { id: "child-1", familyId: "family-1" };
                    }

                    expect(startedLookups).toContain("child-1");
                    expect(startedLookups).toContain("child-2");
                    throw new Error("database offline");
                })
        };

        const timelineRepository = {
            findByIdIncludingDeleted: vi.fn().mockResolvedValue({
                id: "event-1",
                childIds: ["child-1", "child-2"],
                versionHistory: []
            })
        };

        const service = new TimelineApiService(
            {} as any,
            childRepository as any,
            timelineRepository as any,
            undefined
        );

        await expect(service.getEventProof("event-1", {
            id: "user-1",
            familyId: "family-1",
            role: "mom",
            email: "mom@example.com",
            name: "Mom"
        })).rejects.toThrow("Failed to resolve child ownership for timeline item: database offline");

        expect(childRepository.findById).toHaveBeenCalledTimes(2);
        expect(startedLookups).toEqual(["child-1", "child-2"]);
    });
});
