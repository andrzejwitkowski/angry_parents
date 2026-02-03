import { DateProvider } from "../core/ports/DateProvider";

export class RealDateProvider implements DateProvider {
    getNow(): Date {
        return new Date();
    }

    getIsoString(): string {
        return new Date().toISOString();
    }
}
