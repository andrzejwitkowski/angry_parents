import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { MongoChildRepository } from "../MongoChildRepository";
import { ChildModel } from "../../../models/Child";
import type { Child } from "../../../core/domain/child/Child";

const TEST_DB_URI = "mongodb://localhost:27017/angry_parents_test_child";

describe("MongoChildRepository", () => {
    let repository: MongoChildRepository;

    beforeAll(async () => {
        await mongoose.connect(TEST_DB_URI);
        repository = new MongoChildRepository();
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await ChildModel.deleteMany({});
    });

    const mockChild: Child = {
        id: "child-123",
        name: "Test Child",
        icon: "user",
        color: "#FF0000"
    };

    it("should save and retrieve a child", async () => {
        // Save
        const saved = await repository.save(mockChild);
        expect(saved.id).toBe(mockChild.id);
        expect(saved.name).toBe(mockChild.name);

        // Retrieve
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

    it("should find all children", async () => {
        await repository.save(mockChild);
        await repository.save({ ...mockChild, id: "child-456", name: "Second Child" });

        const all = await repository.findAll();
        expect(all.length).toBe(2);

        const ids = all.map(c => c.id);
        expect(ids).toContain("child-123");
        expect(ids).toContain("child-456");
    });

    it("should delete a child", async () => {
        await repository.save(mockChild);
        await repository.delete(mockChild.id);

        const found = await repository.findById(mockChild.id);
        expect(found).toBeNull();
    });
});
