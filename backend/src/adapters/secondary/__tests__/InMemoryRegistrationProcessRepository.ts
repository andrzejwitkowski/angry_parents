import { RegistrationProcess } from "../../../models/RegistrationProcess";

export class InMemoryRegistrationProcessRepository {
    private processes: Map<string, RegistrationProcess> = new Map();

    async findAll(): Promise<RegistrationProcess[]> {
        return Array.from(this.processes.values());
    }

    async findById(id: string): Promise<RegistrationProcess | null> {
        return this.processes.get(id) || null;
    }

    async save(process: any): Promise<RegistrationProcess> {
        const id = process._id || Math.random().toString(36).slice(2);
        const data = { ...process, _id: id } as RegistrationProcess;
        this.processes.set(id, data);
        return data;
    }
}
