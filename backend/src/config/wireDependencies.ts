import mongoose from "mongoose";
import { taskManager } from "../scheduler/instance";
import { MongoForensicRepository } from "../adapters/mongo/repositories/forensic/MongoForensicRepository";
import { BunCryptoService } from "../adapters/security/BunCryptoService";
import { Family } from "../adapters/mongo/models/FamilyModel";
import { MongoTimelineRepository } from "../adapters/mongo/repositories/events/MongoTimelineRepository";
import { MongoRegistrationProcessRepository } from "../adapters/mongo/repositories/auth/MongoRegistrationProcessRepository";
import { MongoCustodyRepository } from "../adapters/mongo/repositories/events/MongoCustodyRepository";
import { MongoScheduleRepository } from "../adapters/mongo/repositories/events/MongoScheduleRepository";
import { MongoChildRepository } from "../adapters/mongo/repositories/family/MongoChildRepository";
import { MongoPasskeyRepository } from "../adapters/mongo/repositories/auth/MongoPasskeyRepository";
import { MongoForensicIntentRepository } from "../adapters/mongo/repositories/forensic/MongoForensicIntentRepository";
import { MockBlockchainAnchor } from "../adapters/blockchain/MockBlockchainAnchor";
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
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/angry_parents";
    await mongoose.connect(mongoUri);

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
    const blockchainAnchor = new MockBlockchainAnchor();

    const forensicService = new ForensicService(forensicRepository, blockchainAnchor, cryptoService, taskManager);
    const timelineService = new TimelineServiceImpl(
        timelineRepository,
        dateProvider,
        uuidProvider,
        cryptoService,
        Family,
        childRepository,
        forensicIntentRepository,
        taskManager
    );
    const scheduleService = new ScheduleService(scheduleRepository, custodyRepository, dateProvider, uuidProvider);
    const propagationService = new PropagationService(scheduleRepository);
    const childService = new ChildService(childRepository, timelineRepository, uuidProvider);

    const timelineApiService = new TimelineApiService(timelineService);
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
