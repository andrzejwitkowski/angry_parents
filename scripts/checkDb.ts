import { withMongoose } from '../backend/src/lib/mongoose-util';
import { Family } from '../backend/src/models/Family';

async function run() {
    await withMongoose(async () => {
        const family = await Family.findOne({ name: "Mock Family" }).lean();
        if (family) {
            // Redact PII: log only non-sensitive fields
            const safeFamily = {
                _id: family._id,
                name: family.name,
                parentIds: family.parentIds,
                childrenCount: family.children?.length || 0,
                createdAt: family.createdAt,
            };
            console.log("Found Family (Redacted):", JSON.stringify(safeFamily, null, 2));
        } else {
            console.log("Mock Family not found.");
        }
    });
}
if (process.env.NODE_ENV === "development" && process.env.CI !== "true") {
    run().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
