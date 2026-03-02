import mongoose from 'mongoose';
import { Family } from './backend/src/models/Family';

async function run() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error("MONGODB_URI is required to run checkDb.ts");
    }
    await mongoose.connect(mongoUri);
    const family = await Family.findOne({ name: "Mock Family" }).lean();
    console.log(JSON.stringify(family, null, 2));
    await mongoose.connection.close();
}
run().catch(console.error);
