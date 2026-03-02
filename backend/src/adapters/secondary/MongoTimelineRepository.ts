import { TimelineRepository } from "../../core/ports/TimelineRepository";
import { EncryptedTimelineItem } from "../../core/domain/TimelineItem";
import { TimelineItemModel } from "../../models/TimelineItem";

export class MongoTimelineRepository implements TimelineRepository {
  constructor() { }

  async save(item: EncryptedTimelineItem): Promise<EncryptedTimelineItem> {
    await TimelineItemModel.findOneAndUpdate(
      { id: item.id },
      item,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).lean();

    return item; // TimelineItems are complex, returning the original object passed in if validation succeeds
  }

  async findByDate(date: string): Promise<EncryptedTimelineItem[]> {
    const items = await TimelineItemModel.find({ date, isDeleted: false }).lean();
    return items as unknown as EncryptedTimelineItem[];
  }

  async findByDateRange(from: string, to: string): Promise<EncryptedTimelineItem[]> {
    const items = await TimelineItemModel.find({
      date: { $gte: from, $lte: to },
      isDeleted: false
    }).lean();
    return items as unknown as EncryptedTimelineItem[];
  }

  async findById(id: string): Promise<EncryptedTimelineItem | null> {
    const item = await TimelineItemModel.findOne({ id, isDeleted: false }).lean();
    if (!item) return null;
    return item as unknown as EncryptedTimelineItem;
  }

  async update(id: string, updates: Partial<EncryptedTimelineItem>): Promise<EncryptedTimelineItem> {
    // Find existing item to ensure we get a new representation
    const existing = await TimelineItemModel.findOne({ id, isDeleted: false }).lean();
    if (!existing) {
      throw new Error(`Item with id ${id} not found`);
    }

    const result = await TimelineItemModel.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' } // Returns the updated document
    ).lean();

    if (!result) {
      throw new Error(`Item with id ${id} not found on update`);
    }

    return result as unknown as EncryptedTimelineItem;
  }

  async delete(id: string): Promise<void> {
    const result = await TimelineItemModel.updateOne(
      { id },
      { $set: { isDeleted: true } }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Item with id ${id} not found`);
    }
  }

  async countByChildId(childId: string): Promise<number> {
    return await TimelineItemModel.countDocuments({ childIds: childId, isDeleted: false });
  }
}
