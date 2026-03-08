import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

export async function connectMongoMemory(): Promise<MongoMemoryServer> {
    const mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    return mongoServer;
}

export async function disconnectMongoMemory(mongoServer: MongoMemoryServer): Promise<void> {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    }
    await mongoServer.stop();
}
