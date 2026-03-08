
import { Elysia } from "elysia";
import { createCustodyController } from "../src/adapters/rest/events/CustodyController";
import { InMemoryCustodyRepository } from "../src/adapters/mongo/inmemory/events/InMemoryCustodyRepository";
import { InMemoryScheduleRepository } from "../src/adapters/mongo/inmemory/events/InMemoryScheduleRepository";
import { RealUuidProvider } from "../src/shared/providers/RealUuidProvider";
import { RealDateProvider } from "../src/shared/providers/RealDateProvider";
import { ScheduleService } from "../src/domain/events/service/ScheduleService";
import { PropagationService } from "../src/domain/events/service/PropagationService";
import { CustodyApiService } from "../src/domain/events/service/CustodyApiService";
import { signJwt } from "../src/lib/jwt";

const repository = new InMemoryCustodyRepository();
const scheduleRepository = new InMemoryScheduleRepository();
const uuidProvider = new RealUuidProvider();
const scheduleService = new ScheduleService(scheduleRepository, repository, new RealDateProvider(), uuidProvider);
const propagationService = new PropagationService(scheduleRepository);
const custodyApiService = new CustodyApiService(repository, scheduleService, propagationService, uuidProvider);
// Simulate how index.ts mounts it
const controller = createCustodyController(custodyApiService);
const app = new Elysia().use(controller);

console.log("Testing POST /api/custody ...");

const testEntry = {
    id: "test",
    childId: "c1",
    date: "2026-01-01",
    startTime: "00:00",
    endTime: "23:59",
    assignedTo: "DAD" as const, // Cast to const literal
    isRecurring: false,
    priority: 0
};

// Simulate a generated request object
// Note: body needs to be a valid JSON string or object depending on how .handle() works with mocked requests.
// Elysia's handle expects a Request object.

const req = new Request("http://localhost:3000/api/custody", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        Cookie: `token=${await signJwt({ userId: "debug-user", familyId: "debug-family", role: "dad", gender: "dad" })}`
    },
    body: JSON.stringify([testEntry])
});

app.handle(req)
    .then(async (res) => {
        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`Response: ${text}`);
        if (res.status === 404) {
            console.error("FAIL: 404 Not Found");
            process.exit(1);
        } else if (res.status === 200 || res.status === 201) {
            console.log("SUCCESS");
            process.exit(0);
        } else {
            console.log("Unexpected Status");
            process.exit(1);
        }
    })
    .catch(err => {
        console.error("Error:", err);
        process.exit(1);
    });
