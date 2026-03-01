import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoRegistrationProcessRepository } from "../MongoRegistrationProcessRepository";
import { ParentRegistrationStatus, RegistrationProcess, RegistrationStatus } from "../../../models/RegistrationProcess";
import { connectMongoMemory, disconnectMongoMemory } from "./mongoMemoryServer";

describe("MongoRegistrationProcessRepository", () => {
    let mongoServer: MongoMemoryServer;
    let repository: MongoRegistrationProcessRepository;

    beforeAll(async () => {
        mongoServer = await connectMongoMemory();
        repository = new MongoRegistrationProcessRepository(mongoose.connection.db as any);
    });

    afterAll(async () => {
        await disconnectMongoMemory(mongoServer);
    });

    beforeEach(async () => {
        await RegistrationProcess.deleteMany({});
    });

    it("should save a new process and find it by id", async () => {
        const created = await repository.save({
            familyId: "family-1",
            familyName: "Family One",
            dadToken: "dad-token",
            momToken: "mom-token",
            dadStatus: ParentRegistrationStatus.INVITATION_SENT,
            momStatus: ParentRegistrationStatus.INVITATION_SENT,
            status: RegistrationStatus.FLOW_STARTED,
            timeline: [],
            adminNotes: ""
        } as any);

        const found = await repository.findById(created._id.toString());
        expect(found).not.toBeNull();
        expect(found?.familyId).toBe("family-1");
    });

    it("should return null for invalid object id", async () => {
        const found = await repository.findById("not-an-object-id");
        expect(found).toBeNull();
    });

    it("should update an existing process", async () => {
        const created = await repository.save({
            familyId: "family-1",
            dadStatus: ParentRegistrationStatus.INVITATION_SENT,
            momStatus: ParentRegistrationStatus.INVITATION_SENT,
            status: RegistrationStatus.FLOW_STARTED,
            timeline: [],
            adminNotes: ""
        } as any);

        const updated = await repository.save({
            _id: created._id,
            familyName: "Updated Family",
            status: RegistrationStatus.PARTIALLY_REGISTERED
        } as any);

        expect(updated.familyName).toBe("Updated Family");
        expect(updated.status).toBe(RegistrationStatus.PARTIALLY_REGISTERED);
    });

    it("should throw when updating non-existent process", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        await expect(repository.save({ _id: fakeId, familyName: "X" } as any)).rejects.toThrow("Process not found");
    });

    it("should find by family id and token", async () => {
        const created = await repository.save({
            familyId: "family-2",
            dadToken: "dad-token-2",
            momToken: "mom-token-2",
            dadStatus: ParentRegistrationStatus.INVITATION_SENT,
            momStatus: ParentRegistrationStatus.INVITATION_SENT,
            status: RegistrationStatus.FLOW_STARTED,
            timeline: [],
            adminNotes: ""
        } as any);

        const byFamily = await repository.findByFamilyId("family-2");
        expect(byFamily?._id.toString()).toBe(created._id.toString());

        const byDadToken = await repository.findByToken("dad-token-2");
        expect(byDadToken?._id.toString()).toBe(created._id.toString());

        const byMomToken = await repository.findByToken("mom-token-2");
        expect(byMomToken?._id.toString()).toBe(created._id.toString());
    });

    it("should append timeline event", async () => {
        const created = await repository.save({
            familyId: "family-3",
            dadStatus: ParentRegistrationStatus.INVITATION_SENT,
            momStatus: ParentRegistrationStatus.INVITATION_SENT,
            status: RegistrationStatus.FLOW_STARTED,
            timeline: [],
            adminNotes: ""
        } as any);

        await repository.addTimelineEvent(created._id.toString(), {
            type: "EMAIL_READ",
            message: "Email opened",
            data: { role: "dad" }
        });

        const found = await repository.findById(created._id.toString());
        expect(found?.timeline.length).toBe(1);
        expect(found?.timeline[0].type).toBe("EMAIL_READ");
        expect(found?.timeline[0].timestamp).toBeDefined();
    });
});
