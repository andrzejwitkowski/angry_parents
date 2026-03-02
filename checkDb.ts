import mongoose from 'mongoose';
import { Family } from './backend/src/models/Family';

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/angry_parents');
    const family = await Family.findOne({ name: "Mock Family" }).lean();
    console.log(JSON.stringify(family, null, 2));
    await mongoose.connection.close();
}
run().catch(console.error);
