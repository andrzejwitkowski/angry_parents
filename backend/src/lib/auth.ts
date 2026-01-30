import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const isProd = process.env.NODE_ENV === "production";

const getDatabaseConfig = () => {
    if (isProd) {
        const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017/angry_parents");
        return {
            adapter: mongodbAdapter(client.db("angry_parents"))
        };
    } else {
        // Local: Memory adapter is built-in and perfect for zero-setup dev
        // Better Auth will handle the memory storage if no adapter is provided 
        // or if we use a specific memory one if available.
        // In Better Auth 1.x, if you don't provide an adapter, it defaults to memory
        // or you can use the memory adapter explicitly.
        return {};
    }
};

export const auth = betterAuth({
    ...getDatabaseConfig(),
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            username: {
                type: "string",
                required: true,
                unique: true,
            },
        },
    },
    trustedOrigins: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
});
