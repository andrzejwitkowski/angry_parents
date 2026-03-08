export interface DateProvider {
    getNow(): Date;
    getIsoString(): string;
}
