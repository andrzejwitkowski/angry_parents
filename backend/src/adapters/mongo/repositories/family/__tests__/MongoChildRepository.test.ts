import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Connection, Model, Schema } from "mongoose";
import { MongoChildRepository } from "../MongoChildRepository";
import type { Child } from "../../../../../domain/family/model/Child";

interface TestFamilyDocument extends mongoose.Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    parentIds: string[];
    parentPublicKeys: unknown[];
    children: Array<{
        id: string;
        name: string;
        icon: string;
        color: string;
    }>;
    custodyPatterns: unknown[];
}

const FamilyChildSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    icon: { type: String, required: true },
    color: { type: String, required: true },
}, { _id: false });

const FamilySchema = new Schema<TestFamilyDocument>({
    name: { type: String, required: true },
    parentIds: [{ type: String }],
    parentPublicKeys: [{ type: Schema.Types.Mixed }],
    children: [FamilyChildSchema],
    custodyPatterns: [{ type: Schema.Types.Mixed }],
});

describe("MongoChildRepository", () => {
    let repository: MongoChildRepository;
    let mongoServer: MongoMemoryServer;
    let connection: Connection;
    let Family: Model<TestFamilyDocument>;
    let familyOneId: string;
    let familyTwoId: string;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        connection = await mongoose.createConnection(mongoServer.getUri()).asPromise();
        Family = connection.model<TestFamilyDocument>("Family", FamilySchema);
        repository = new MongoChildRepository(Family);
    });

    afterAll(async () => {
        await connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        familyOneId = new mongoose.Types.ObjectId().toString();
        familyTwoId = new mongoose.Types.ObjectId().toString();

        await Family.deleteMany({});
        await Family.create({
            _id: familyOneId,
            name: "Family One",
            parentIds: ["parent-1"],
            parentPublicKeys: [],
            children: [],
            custodyPatterns: []
        });
        await Family.create({
            _id: familyTwoId,
            name: "Family Two",
            parentIds: ["parent-2"],
            parentPublicKeys: [],
            children: [],
            custodyPatterns: []
        });
    });

    const createChild = (overrides: Partial<Child> = {}): Child => ({
        id: "child-123",
        name: "Test Child",
        icon: "user",
        color: "#FF0000",
        familyId: familyOneId,
        ...overrides,
    });

    it("saves and retrieves children from Family.children", async () => {
        const child = createChild();

        const saved = await repository.save(child);
        const found = await repository.findById(child.id);
        const family = await Family.findById(familyOneId).lean();

        expect(saved).toEqual(child);
        expect(found).toEqual(child);
        expect(family?.children).toEqual([
            {
                id: child.id,
                name: child.name,
                icon: child.icon,
                color: child.color,
            }
        ]);
    });

    it("updates an existing embedded child", async () => {
        await repository.save(createChild());

        await repository.save(createChild({ name: "Updated Name", color: "#00FF00" }));

        const found = await repository.findById("child-123");
        expect(found?.name).toBe("Updated Name");
        expect(found?.color).toBe("#00FF00");
    });

    it("finds all children by family id", async () => {
        await repository.save(createChild());
        await repository.save(createChild({ id: "child-456", name: "Second Child" }));
        await repository.save(createChild({ id: "child-999", familyId: familyTwoId, name: "Other Family Child" }));

        const all = await repository.findAllByFamilyId(familyOneId);
        expect(all).toHaveLength(2);
        expect(all.map(child => child.id)).toEqual(["child-123", "child-456"]);
    });

    it("deletes an embedded child", async () => {
        await repository.save(createChild());

        await repository.delete("child-123");

        expect(await repository.findById("child-123")).toBeNull();
        expect(await repository.findAllByFamilyId(familyOneId)).toEqual([]);
    });
});
