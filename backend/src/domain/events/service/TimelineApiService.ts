import type { TimelineServiceImpl } from "./TimelineService";
import type { CreateTimelineItemDto } from "../model/TimelineItem";
import type { SessionUser } from "../../shared/types/SessionUser";

function isParentRole(role?: string): role is "mom" | "dad" {
    return role === "mom" || role === "dad";
}

function selectCiphertextForUser(items: any[], userId: string) {
    return items.map((item) => {
        const plainItem = item.toObject ? item.toObject() : item;
        const typedItem = plainItem as Record<string, any>;
        const payload = typedItem.encryptedPayload as Record<string, string> | undefined;
        if (!payload) return plainItem;

        const ciphertext = payload[userId];
        const { encryptedPayload: _, ...rest } = typedItem;

        if (!ciphertext && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
            console.warn(
                `Missing ciphertext for userId: ${userId}. Available encryptedPayload keys:`,
                Object.keys(payload)
            );
        }

        return {
            ...rest,
            ciphertext: ciphertext ?? ""
        };
    });
}

function selectSingleCiphertextForUser(item: any, userId: string) {
    return selectCiphertextForUser([item], userId)[0];
}

export class TimelineApiService {
    constructor(private readonly service: TimelineServiceImpl) { }

    async getItemsByDate(date: string, user: SessionUser | null) {
        if (!user) {
            const error = new Error("Unauthorized");
            (error as any).status = 401;
            throw error;
        }
        if (!isParentRole(user.role)) {
            const error = new Error("Forbidden: parent role required");
            (error as any).status = 403;
            throw error;
        }
        const items = await this.service.getItemsByDate(date);
        return { items: selectCiphertextForUser(items, user.id) };
    }

    async getItemsByDateRange(from: string, to: string, user: SessionUser | null) {
        if (!user) {
            const error = new Error("Unauthorized");
            (error as any).status = 401;
            throw error;
        }
        if (!isParentRole(user.role)) {
            const error = new Error("Forbidden: parent role required");
            (error as any).status = 403;
            throw error;
        }
        const items = await this.service.getItemsByDateRange(from, to);
        return { items: selectCiphertextForUser(items, user.id) };
    }

    async createItem(body: any, user: SessionUser | null) {
        if (!isParentRole(user?.role)) {
            const error = new Error("Forbidden: parent role required");
            (error as any).status = 403;
            throw error;
        }

        if (!body.signatureBase64 || !body.timestamp || !body.keyId) {
            const error = new Error("signatureBase64, timestamp, and keyId are required for data integrity");
            (error as any).status = 400;
            throw error;
        }

        const userId = user?.id || "anonymous";
        const userName = user?.name || "Unknown";

        const item = await this.service.createItem({
            type: body.type,
            date: body.date,
            childId: body.childId,
            encryption: body.encryption,
            encryptedPayload: body.encryptedPayload,
            signatureBase64: body.signatureBase64,
            timestamp: body.timestamp,
            keyId: body.keyId,
            createdBy: userId,
            createdByName: userName
        } as any);

        const plainItem = (item as any).toObject ? (item as any).toObject() : item;
        return selectSingleCiphertextForUser(plainItem, user.id);
    }

    async updateItem(id: string, body: any, user: SessionUser | null) {
        if (!user) {
            const error = new Error("Unauthorized");
            (error as any).status = 401;
            throw error;
        }
        if (!isParentRole(user.role)) {
            const error = new Error("Forbidden: parent role required");
            (error as any).status = 403;
            throw error;
        }

        const payload = body as CreateTimelineItemDto & { childId: string; signatureBase64: string; timestamp: string; keyId: string };
        if (!payload.childId || !payload.signatureBase64 || !payload.timestamp || !payload.keyId) {
            const error = new Error("childId, signatureBase64, timestamp, and keyId are required");
            (error as any).status = 400;
            throw error;
        }

        const userName = user.name || "Unknown";
        const updated = await this.service.updateItem(
            id,
            payload as any,
            user.id,
            payload.childId,
            {
                signatureBase64: payload.signatureBase64,
                timestamp: payload.timestamp,
                keyId: payload.keyId
            },
            userName
        );
        const plainUpdated = (updated as any).toObject ? (updated as any).toObject() : updated;
        return selectSingleCiphertextForUser(plainUpdated, user.id);
    }

    async deleteItem(id: string, body: any, user: SessionUser | null): Promise<void> {
        if (!user) {
            const error = new Error("Unauthorized");
            (error as any).status = 401;
            throw error;
        }
        if (!isParentRole(user.role)) {
            const error = new Error("Forbidden: parent role required");
            (error as any).status = 403;
            throw error;
        }

        const payload = body as { signatureBase64: string; timestamp: string; keyId: string };
        if (!payload.signatureBase64 || !payload.timestamp || !payload.keyId) {
            const error = new Error("signatureBase64, timestamp, and keyId are required");
            (error as any).status = 400;
            throw error;
        }

        const userName = user.name || "Unknown";
        await this.service.deleteItem(id, user.id, {
            signatureBase64: payload.signatureBase64,
            timestamp: payload.timestamp,
            keyId: payload.keyId
        }, userName);
    }
}
