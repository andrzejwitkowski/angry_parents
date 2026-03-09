import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import mongoose from "mongoose";

import { connectMongoMemory, disconnectMongoMemory } from "./mongoMemoryServer";

describe("mongoMemoryServer helper", () => {
    afterAll(async () => {
        await disconnectMongoMemory();
    });

    beforeEach(async () => {
        await connectMongoMemory();
        await mongoose.connection.dropDatabase();
    });

    it("preserves data across repeated helper connections", async () => {
        await mongoose.connection.collection("connection_probe").insertOne({ id: "probe-1" });

        await connectMongoMemory();

        const count = await mongoose.connection.collection("connection_probe").countDocuments({ id: "probe-1" });

        expect(count).toBe(1);
    });
});
