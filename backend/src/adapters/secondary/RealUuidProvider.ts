import { UuidProvider } from "../core/ports/UuidProvider";

export class RealUuidProvider implements UuidProvider {
    generate(): string {
        return crypto.randomUUID();
    }
}
