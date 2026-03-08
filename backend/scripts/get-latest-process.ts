import mongoose from "mongoose";
import { MongoRegistrationProcessRepository } from "../src/adapters/mongo/repositories/auth/MongoRegistrationProcessRepository";

await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/angry_parents");

if (!mongoose.connection.db) {
    throw new Error("MongoDB connection not established");
}

const repo = new MongoRegistrationProcessRepository(mongoose.connection.db as any);
const processes = await repo.findAll();
console.log(JSON.stringify(processes[0] ?? null));
await mongoose.disconnect();
