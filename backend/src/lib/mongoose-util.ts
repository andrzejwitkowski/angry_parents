import mongoose from "mongoose";

/**
 * Utility to run an action with a managed Mongoose connection.
 * Connects to MongoDB, executes the provided action, and ensures
 * the connection is closed in the finally block.
 * 
 * @param action - The asynchronous function to execute while connected
 * @returns The result of the action
 */
export async function withMongoose<T>(action: () => Promise<T>): Promise<T> {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error("MONGODB_URI environment variable is required");
    }

    try {
        await mongoose.connect(mongoUri);
        return await action();
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    }
}
