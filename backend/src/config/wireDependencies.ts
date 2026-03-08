import mongoose from "mongoose";
import { taskManager } from "../scheduler/instance";
import { MongoForensicRepository } from "../adapters/mongo/repositories/forensic/MongoForensicRepository";
import { BunCryptoService } from "../adapters/security/BunCryptoService";
import { MongoTimelineRepository } from "../adapters/mongo/repositories/events/MongoTimelineRepository";
import { MongoRegistrationProcessRepository } from "../adapters/mongo/repositories/auth/MongoRegistrationProcessRepository";
import { MongoCustodyRepository } from "../adapters/mongo/repositories/events/MongoCustodyRepository";
import { MongoScheduleRepository } from "../adapters/mongo/repositories/events/MongoScheduleRepository";
import { MongoChildRepository } from "../adapters/mongo/repositories/family/MongoChildRepository";
import { MongoPasskeyRepository } from "../adapters/mongo/repositories/auth/MongoPasskeyRepository";
import { MongoForensicIntentRepository } from "../adapters/mongo/repositories/forensic/MongoForensicIntentRepository";
import { MockBlockchainAnchor } from "../adapters/blockchain/MockBlockchainAnchor";
import { ViemBlockchainAnchor } from "../adapters/blockchain/ViemBlockchainAnchor";
import { TimelineApiService } from "../domain/events/service/TimelineApiService";
import { CustodyApiService } from "../domain/events/service/CustodyApiService";
import { FamilyApiService } from "../domain/family/service/FamilyApiService";
import { ForensicApiService } from "../domain/forensic/service/ForensicApiService";
import { RealDateProvider } from "../shared/providers/RealDateProvider";
import { RealUuidProvider } from "../shared/providers/RealUuidProvider";
import { ForensicService } from "../domain/forensic/service/ForensicService";
import { TimelineServiceImpl } from "../domain/events/service/TimelineService";
import { ScheduleService } from "../domain/events/service/ScheduleService";
import { PropagationService } from "../domain/events/service/PropagationService";
import { ChildService } from "../domain/family/service/ChildService";

export async function wireDependencies() {
    const mongoUri = process.env.MONGODB_URI;
    const isTestMode =
        process.env.NODE_ENV === "test" ||
        process.env.E2E_TEST === "true" ||
        process.env.INTEGRATION_TEST === "true" ||
        process.env.ENABLE_TEST_ENDPOINTS === "true";
    const fallbackMongoUri = "mongodb://localhost:27017/angry_parents";

    if (!mongoUri && !isTestMode && process.env.NODE_ENV === "production") {
        throw new Error("MONGODB_URI is required in production");
    }

    const effectiveMongoUri = mongoUri || fallbackMongoUri;

    if (!mongoUri && !isTestMode) {
        console.warn("[wireDependencies] MONGODB_URI not set; using local fallback");
    }

    await mongoose.connect(effectiveMongoUri);

    if (!mongoose.connection.db) {
        throw new Error("MongoDB connection not established");
    }

    const dateProvider = new RealDateProvider();
    const uuidProvider = new RealUuidProvider();

    const registrationProcessRepository = new MongoRegistrationProcessRepository(mongoose.connection.db as any);
    const forensicRepository = new MongoForensicRepository(mongoose.connection.db as any);
    const timelineRepository = new MongoTimelineRepository();
    const forensicIntentRepository = new MongoForensicIntentRepository();
    const custodyRepository = new MongoCustodyRepository();
    const scheduleRepository = new MongoScheduleRepository();
    const childRepository = new MongoChildRepository();
    const passkeyRepository = new MongoPasskeyRepository();

    const cryptoService = new BunCryptoService();
    const useMockBlockchain =
        process.env.USE_MOCK_BLOCKCHAIN === "true" ||
        process.env.NODE_ENV === "test" ||
        process.env.E2E_TEST === "true";

    const blockchainAnchor = useMockBlockchain
        ? new MockBlockchainAnchor()
        : new ViemBlockchainAnchor();

    const forensicService = new ForensicService(forensicRepository, blockchainAnchor, cryptoService, taskManager);
    const timelineService = new TimelineServiceImpl(
        timelineRepository,
        dateProvider,
        uuidProvider,
        cryptoService,
        childRepository,
        passkeyRepository,
        forensicIntentRepository,
        taskManager
    );
    const scheduleService = new ScheduleService(scheduleRepository, custodyRepository, dateProvider, uuidProvider);
    const propagationService = new PropagationService(scheduleRepository);
    const childService = new ChildService(childRepository, timelineRepository, uuidProvider);

    const timelineApiService = new TimelineApiService(timelineService, childRepository);
    const custodyApiService = new CustodyApiService(custodyRepository, scheduleService, propagationService, uuidProvider);
    const familyApiService = new FamilyApiService(childService);
    const forensicApiService = new ForensicApiService(forensicService, forensicRepository);

    return {
        dateProvider,
        registrationProcessRepository,
        forensicRepository,
        timelineRepository,
        forensicIntentRepository,
        custodyRepository,
        scheduleRepository,
        childRepository,
        passkeyRepository,
        cryptoService,
        blockchainAnchor,
        forensicService,
        timelineService,
        scheduleService,
        propagationService,
        childService,
        timelineApiService,
        custodyApiService,
        familyApiService,
        forensicApiService,
    };
}
