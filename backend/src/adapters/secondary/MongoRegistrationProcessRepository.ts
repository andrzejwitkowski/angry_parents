import { Db, ObjectId } from "mongodb";
import { IRegistrationProcess, RegistrationProcess, RegistrationStatus } from "../../models/RegistrationProcess";

export class MongoRegistrationProcessRepository {
    private collectionName = "registrationprocesses";

    constructor(private db: Db) { }

    async findAll(): Promise<IRegistrationProcess[]> {
        return RegistrationProcess.find().sort({ createdAt: -1 }).exec();
    }

    async findById(id: string): Promise<IRegistrationProcess | null> {
        if (!ObjectId.isValid(id)) return null;
        return RegistrationProcess.findById(id).exec();
    }

    async save(process: Partial<IRegistrationProcess>): Promise<IRegistrationProcess> {
        if (process._id) {
            const updated = await RegistrationProcess.findByIdAndUpdate(
                process._id,
                { $set: process },
                { new: true }
            ).exec();
            if (!updated) throw new Error("Process not found");
            return updated;
        }
        const newProcess = new RegistrationProcess(process);
        return newProcess.save();
    }

    async findByFamilyId(familyId: string): Promise<IRegistrationProcess | null> {
        return RegistrationProcess.findOne({ familyId }).exec();
    }

    async findByToken(token: string): Promise<IRegistrationProcess | null> {
        return RegistrationProcess.findOne({
            $or: [
                { dadToken: token },
                { momToken: token }
            ]
        }).exec();
    }

    async addTimelineEvent(id: string, event: { type: string, message: string, data?: any }): Promise<void> {
        await RegistrationProcess.findByIdAndUpdate(id, {
            $push: {
                timeline: {
                    ...event,
                    timestamp: new Date()
                }
            }
        }).exec();
    }
}
