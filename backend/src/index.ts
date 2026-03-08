import { createApp } from "./config/createApp";

const { app: finalApp, deps } = await createApp();

finalApp.listen({
    port: parseInt(process.env.PORT || "3000"),
    hostname: "0.0.0.0"
});

(globalThis as any).app = finalApp;

console.log(`Server running at ${finalApp.server?.hostname}:${finalApp.server?.port}`);
console.log("   - Auth API: /api/auth/*");
console.log("   - Timeline API: /api/timeline, /api/calendar/:date/timeline");
console.log(`   - Health Check: /api/health @ ${deps.dateProvider.getIsoString()}`);
console.log("   - Custody API: /api/custody");
