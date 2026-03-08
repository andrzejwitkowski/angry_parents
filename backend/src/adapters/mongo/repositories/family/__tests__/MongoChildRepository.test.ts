import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoChildRepository } from "../MongoChildRepository";
import { ChildModel } from "../../../models/ChildModel";
import type { Child } from "../../../../../domain/family/model/Child";
import { connectMongoMemory, disconnectMongoMemory } from "../../../__tests__/mongoMemoryServer";

describe("MongoChildRepository", () => {
    let repository: MongoChildRepository;
    let mongoServer: MongoMemoryServer;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
        repository = new MongoChildRepository();
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    beforeEach(async () => {
        await ChildModel.deleteMany({});
    });

    const mockChild: Child = {
        id: "child-123",
        name: "Test Child",
        icon: "user",
        color: "#FF0000",
        familyId: "family-123"
    };

    it("should save and retrieve a child", async () => {
        const saved = await repository.save(mockChild);
        expect(saved.id).toBe(mockChild.id);
        expect(saved.name).toBe(mockChild.name);

        const found = await repository.findById(mockChild.id);
        expect(found).not.toBeNull();
        expect(found?.name).toBe(mockChild.name);
        expect(found?.icon).toBe(mockChild.icon);
        expect(found?.color).toBe(mockChild.color);
    });

    it("should return null for non-existent child", async () => {
        const found = await repository.findById("non-existent");
        expect(found).toBeNull();
    });

    it("should update an existing child", async () => {
        await repository.save(mockChild);

        const updatedChild = { ...mockChild, name: "Updated Name" };
        await repository.save(updatedChild);

        const found = await repository.findById(mockChild.id);
        expect(found?.name).toBe("Updated Name");
    });

    it("should find all children by familyId", async () => {
        await repository.save(mockChild);

        const child2: Child = { ...mockChild, id: "child-456", name: "Second Child", familyId: "family-123" };
        await repository.save(child2);

        const diffFamilyChild: Child = { ...mockChild, id: "child-999", name: "Diff Family Child", familyId: "family-999" };
        await repository.save(diffFamilyChild);

        const all = await repository.findAllByFamilyId("family-123");
        expect(all.length).toBe(2);

        const ids = all.map(c => c.id);
        expect(ids).toContain("child-123");
        expect(ids).toContain("child-456");
        expect(ids).not.toContain("child-999");
    });

    it("should delete a child", async () => {
        await repository.save(mockChild);
        await repository.delete(mockChild.id);

        const found = await repository.findById(mockChild.id);
        expect(found).toBeNull();
    });
});
