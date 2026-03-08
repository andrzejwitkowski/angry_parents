import { UuidProvider } from "../../domain/shared/ports/UuidProvider";

export class RealUuidProvider implements UuidProvider {
    generate(): string {
        return crypto.randomUUID();
    }
}
