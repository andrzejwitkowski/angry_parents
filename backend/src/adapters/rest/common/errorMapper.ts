export function formatErrorResponse(error: unknown): string {
    if (error && (error as any).name === "ZodError" && (error as any).issues) {
        try {
            return (error as any).issues.map((issue: any) => {
                const path = issue.path.join(".");
                return `${path ? path + ": " : ""}${issue.message}`;
            }).join(", ");
        } catch {
        }
    }
    return error instanceof Error ? error.message : String(error);
}

export function mapErrorToStatus(error: unknown): number {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    if (lower.includes("timeline item with id") && lower.includes("not found")) {
        return 404;
    }

    const isForbidden = [
        "unauthorized",
        "modify your own",
        "does not belong",
        "parent role required"
    ].some(term => lower.includes(term));

    if (isForbidden) {
        return 403;
    }

    const isBadRequest = [
        "invalid",
        "required",
        "cannot encrypt",
        "must have registered",
        "cannot be in the past",
        "must include",
        "cannot be"
    ].some(term => lower.includes(term)) || (error as any)?.name === "ZodError";

    if (isBadRequest) {
        return 400;
    }

    return 500;
}
