import type { ChildService } from "./ChildService";
import type { SessionUser } from "../../shared/types/SessionUser";

export class FamilyApiService {
    constructor(private readonly childService: ChildService) { }

    private assertFamilyUser(user: SessionUser | null): SessionUser {
        if (!user) {
            const error = new Error("Unauthorized");
            (error as any).status = 401;
            throw error;
        }
        if (!user.familyId) {
            const error = new Error("Unauthorized: No family assigned");
            (error as any).status = 401;
            throw error;
        }
        return user;
    }

    async getAllChildren(user: SessionUser | null) {
        const familyUser = this.assertFamilyUser(user);
        return this.childService.getAllChildren(familyUser.familyId as string);
    }

    async addChild(body: { name: string; icon: string; color: string }, user: SessionUser | null) {
        const familyUser = this.assertFamilyUser(user);
        return this.childService.addChild(familyUser.familyId as string, body);
    }

    async updateChild(id: string, body: Record<string, unknown>, user: SessionUser | null) {
        const familyUser = this.assertFamilyUser(user);
        const child = await this.childService.getChild(id);
        if (!child) {
            const error = new Error(`Child with id ${id} not found`);
            (error as any).status = 404;
            throw error;
        }
        if (child.familyId !== familyUser.familyId) {
            const error = new Error("Forbidden: child does not belong to your family");
            (error as any).status = 403;
            throw error;
        }
        const safeUpdates: Partial<{ name: string; icon: string; color: string }> = {};
        if (typeof body.name === "string") safeUpdates.name = body.name;
        if (typeof body.icon === "string") safeUpdates.icon = body.icon;
        if (typeof body.color === "string") safeUpdates.color = body.color;
        return this.childService.updateChild(id, safeUpdates);
    }

    async deleteChild(id: string, user: SessionUser | null) {
        const familyUser = this.assertFamilyUser(user);
        const child = await this.childService.getChild(id);
        if (!child) {
            const error = new Error(`Child with id ${id} not found`);
            (error as any).status = 404;
            throw error;
        }
        if (child.familyId !== familyUser.familyId) {
            const error = new Error("Forbidden: child does not belong to your family");
            (error as any).status = 403;
            throw error;
        }
        try {
            await this.childService.deleteChild(id);
            return { success: true };
        } catch (error) {
            if ((error as Error).message.includes("linked")) {
                (error as any).status = 400;
            }
            throw error;
        }
    }
}
