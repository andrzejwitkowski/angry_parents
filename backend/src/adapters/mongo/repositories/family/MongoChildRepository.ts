import { ChildRepository } from "../../../../domain/family/ports/ChildRepository";
import { Child } from "../../../../domain/family/model/Child";
import { Family, IFamily } from "../../models/FamilyModel";
import { Model } from "mongoose";

export class MongoChildRepository implements ChildRepository {
    constructor(private readonly familyModel: Model<IFamily> = Family) {}

    async save(child: Child): Promise<Child> {
        if (!child.familyId) {
            throw new Error("Child familyId is required");
        }

        const family = await this.familyModel.findById(child.familyId);
        if (!family) {
            throw new Error(`Family with id ${child.familyId} not found`);
        }

        const currentChildren = (family.children || []).map((entry: any) => ({
            id: entry.id,
            name: entry.name,
            icon: entry.icon,
            color: entry.color,
        }));

        const existingIndex = currentChildren.findIndex(existing => existing.id === child.id);
        const nextChild = {
            id: child.id,
            name: child.name,
            icon: child.icon,
            color: child.color,
        };

        if (existingIndex >= 0) {
            currentChildren[existingIndex] = nextChild;
        } else {
            currentChildren.push(nextChild);
        }

        family.set("children", currentChildren);
        await family.save();
        return child;
    }

    async findAllByFamilyId(familyId: string): Promise<Child[]> {
        const family = await this.familyModel.findById(familyId).lean();
        if (!family) {
            return [];
        }

        return (family.children || []).map((child: any) => ({
            id: child.id,
            name: child.name,
            icon: child.icon,
            color: child.color,
        }));
    }

    async findById(id: string): Promise<Child | null> {
        const family = await this.familyModel.findOne({ "children.id": id }).lean();
        if (!family) return null;

        const child = (family.children || []).find((entry: any) => entry.id === id);
        if (!child) return null;

        return {
            id: child.id,
            name: child.name,
            icon: child.icon,
            color: child.color,
            familyId: family._id.toString(),
        };
    }

    async delete(id: string): Promise<void> {
        await this.familyModel.updateOne(
            { "children.id": id },
            { $pull: { children: { id } } }
        );
    }
}
