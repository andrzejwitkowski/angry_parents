import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod";
const JWT_ALGORITHM = "HS256";
const JWT_EXPIRY = "7d";

export interface JwtPayload extends JWTPayload {
    userId: string;
    familyId?: string;
    role?: "parent_a" | "parent_b";
    gender?: "mom" | "dad";
}

export async function signJwt(payload: Omit<JwtPayload, "exp">): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: JWT_ALGORITHM })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY)
        .sign(new TextEncoder().encode(JWT_SECRET));
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(JWT_SECRET)
        );
        return payload as JwtPayload;
    } catch {
        return null;
    }
}

export function generateJwtSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString("base64");
}
