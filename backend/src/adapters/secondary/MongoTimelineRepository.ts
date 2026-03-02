import { TimelineRepository } from "../../core/ports/TimelineRepository";
import { EncryptedTimelineItem } from "../../core/domain/TimelineItem";
import { TimelineItemModel } from "../../models/TimelineItem";
import mongoose, { ClientSession } from "mongoose";

export class MongoTimelineRepository implements TimelineRepository {
  constructor() { }

  async save(item: EncryptedTimelineItem, session?: unknown): Promise<EncryptedTimelineItem> {
    const mongooseSession = session as ClientSession | undefined;
    await TimelineItemModel.findOneAndUpdate(
      { id: item.id },
      item,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session: mongooseSession }
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

  async update(id: string, updates: Partial<EncryptedTimelineItem>, session?: unknown): Promise<EncryptedTimelineItem> {
    const mongooseSession = session as ClientSession | undefined;
    // Find existing item to ensure we get a new representation
    const existing = await TimelineItemModel.findOne({ id, isDeleted: false }, null, { session: mongooseSession }).lean();
    if (!existing) {
      throw new Error(`Item with id ${id} not found`);
    }

    const result = await TimelineItemModel.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after', session: mongooseSession } // Returns the updated document
    ).lean();

    if (!result) {
      throw new Error(`Item with id ${id} not found on update`);
    }

    return result as unknown as EncryptedTimelineItem;
  }

  async delete(id: string, session?: unknown): Promise<void> {
    const mongooseSession = session as ClientSession | undefined;
    const result = await TimelineItemModel.updateOne(
      { id },
      { $set: { isDeleted: true } },
      { session: mongooseSession }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Item with id ${id} not found`);
    }
  }

  async countByChildId(childId: string): Promise<number> {
    return await TimelineItemModel.countDocuments({ childIds: childId, isDeleted: false });
  }

  async withTransaction<T>(operation: (session?: unknown) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
