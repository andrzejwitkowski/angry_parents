import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let sharedMongoServer: MongoMemoryServer | null = null;
let sharedMongoUri: string | null = null;
let leaseCount = 0;

export async function connectMongoMemory(): Promise<MongoMemoryServer> {
    if (!sharedMongoServer) {
        sharedMongoServer = await MongoMemoryServer.create();
        sharedMongoUri = sharedMongoServer.getUri();
    }

    leaseCount += 1;

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(sharedMongoUri!);
    }

    return sharedMongoServer;
}

export async function disconnectMongoMemory(_mongoServer?: MongoMemoryServer): Promise<void> {
    if (leaseCount > 0) {
        leaseCount -= 1;
    }

    if (leaseCount > 0) {
        return;
    }

    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    }

    if (sharedMongoServer) {
        await sharedMongoServer.stop();
    }

    sharedMongoServer = null;
    sharedMongoUri = null;
}
