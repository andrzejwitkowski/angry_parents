import { IRegistrationProcess } from "../../models/RegistrationProcessModel";

export class InMemoryRegistrationProcessRepository {
    private processes: Map<string, IRegistrationProcess> = new Map();

    async findAll(): Promise<IRegistrationProcess[]> {
        return Array.from(this.processes.values());
    }

    async findById(id: string): Promise<IRegistrationProcess | null> {
        return this.processes.get(id) || null;
    }

    async save(process: any): Promise<IRegistrationProcess> {
        const id = process._id || Math.random().toString(36).slice(2);
        const data = { ...process, _id: id } as IRegistrationProcess;
        this.processes.set(id, data);
        return data;
    }
}
