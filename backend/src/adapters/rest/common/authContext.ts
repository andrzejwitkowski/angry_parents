import { verifyJwt } from "../../../lib/jwt";
import type { SessionUser } from "../../../domain/shared/types/SessionUser";

export function getJwtFromCookie(request: Request): string | null {
    const cookie = request.headers.get("Cookie");
    if (!cookie) return null;
    const match = cookie.match(/token=([^;]+)/);
    return match ? match[1] : null;
}

export async function resolveSessionUser(request: Request): Promise<SessionUser | null> {
    const token = getJwtFromCookie(request);
    if (!token) return null;

    try {
        const payload = await verifyJwt(token);
        if (!payload) return null;

        return {
            id: payload.userId as string,
            name: payload.role as string,
            email: payload.email as string,
            role: payload.role as string,
            familyId: payload.familyId as string,
        };
    } catch {
        return null;
    }
}
