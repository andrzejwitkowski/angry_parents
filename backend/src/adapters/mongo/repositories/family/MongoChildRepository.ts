import { ChildRepository } from "../../../../domain/family/ports/ChildRepository";
import { Child } from "../../../../domain/family/model/Child";
import { ChildModel } from "../../models/ChildModel";

export class MongoChildRepository implements ChildRepository {
    async save(child: Child): Promise<Child> {
        const result = await ChildModel.findOneAndUpdate(
            { id: child.id },
            child,
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        ).lean();

        return {
            id: result.id,
            name: result.name,
            icon: result.icon,
            color: result.color,
            familyId: result.familyId
        };
    }

    async findAllByFamilyId(familyId: string): Promise<Child[]> {
        const children = await ChildModel.find({ familyId }).lean();
        return children.map(c => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            color: c.color,
            familyId: c.familyId
        }));
    }

    async findById(id: string): Promise<Child | null> {
        const child = await ChildModel.findOne({ id }).lean();
        if (!child) return null;
        return {
            id: child.id,
            name: child.name,
            icon: child.icon,
            color: child.color,
            familyId: child.familyId
        };
    }

    async delete(id: string): Promise<void> {
        await ChildModel.deleteOne({ id });
    }
}
