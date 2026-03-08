import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, Db } from "mongodb";
import { MongoForensicRepository } from "../MongoForensicRepository";
import { ForensicDocument } from "../../../../../domain/forensic/model/ForensicDocument";
import { SystemState } from "../../../../../domain/forensic/model/SystemState";

describe("MongoForensicRepository", () => {
    let mongoServer: MongoMemoryServer;
    let client: MongoClient;
    let db: Db;
    let repository: MongoForensicRepository;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        client = new MongoClient(mongoServer.getUri());
        await client.connect();
        db = client.db("forensic_repo_test");
        repository = new MongoForensicRepository(db);
    });

    afterAll(async () => {
        await client.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await db.collection("forensic_documents").deleteMany({});
        await db.collection("system_state").deleteMany({});
    });

    it("should save and get document by index", async () => {
        const doc = new ForensicDocument(1, { text: "a" }, "prev", new Date().toISOString(), "PENDING", [], "hash-1");
        await repository.saveDocument(doc);

        const found = await repository.getDocumentByIndex<{ text: string }>(1);
        expect(found).not.toBeNull();
        expect(found?.index).toBe(1);
        expect((found?.content as any).text).toBe("a");
    });

    it("should upsert by index", async () => {
        const timestamp = new Date().toISOString();
        const first = new ForensicDocument(2, { text: "v1" }, "prev", timestamp, "PENDING", [], "hash-2");
        await repository.saveDocument(first);

        const second = new ForensicDocument(2, { text: "v2" }, "prev", timestamp, "FINALIZED", [], "hash-2");
        await repository.saveDocument(second);

        const found = await repository.getDocumentByIndex<{ text: string }>(2);
        expect((found?.content as any).text).toBe("v2");
        expect(found?.status).toBe("FINALIZED");
    });

    it("should get last finalized document", async () => {
        await repository.saveDocument(new ForensicDocument(1, { text: "a" }, "prev", new Date().toISOString(), "FINALIZED", [], "hash-1"));
        await repository.saveDocument(new ForensicDocument(3, { text: "c" }, "prev", new Date().toISOString(), "PENDING", [], "hash-3"));
        await repository.saveDocument(new ForensicDocument(2, { text: "b" }, "prev", new Date().toISOString(), "FINALIZED", [], "hash-2"));

        const last = await repository.getLastFinalizedDocument<{ text: string }>();
        expect(last).not.toBeNull();
        expect(last?.index).toBe(2);
    });

    it("should return all documents sorted by index", async () => {
        await repository.saveDocument(new ForensicDocument(10, { text: "x" }, "prev", new Date().toISOString(), "PENDING", [], "hash-10"));
        await repository.saveDocument(new ForensicDocument(1, { text: "y" }, "prev", new Date().toISOString(), "PENDING", [], "hash-1"));

        const all = await repository.getAllDocuments<{ text: string }>();
        expect(all.length).toBe(2);
        expect(all[0].index).toBe(1);
        expect(all[1].index).toBe(10);
    });

    it("should store singleton system state with replacement", async () => {
        const first: SystemState = {
            totalDocs: 1,
            lastFinalHash: "h1",
            updatedAt: new Date().toISOString(),
            signatures: []
        };
        await repository.saveSystemState(first);

        const second: SystemState = {
            totalDocs: 2,
            lastFinalHash: "h2",
            updatedAt: new Date().toISOString(),
            signatures: [{ signerId: "x" }]
        };
        await repository.saveSystemState(second);

        const state = await repository.getSystemState();
        expect(state?.totalDocs).toBe(2);
        expect(state?.lastFinalHash).toBe("h2");
    });
});
