import type { TimelineItem, PlainTimelineItem } from "@/types/timeline.types";
import { MedicalCard } from "./cards/MedicalCard";
import { HandoverCard } from "./cards/HandoverCard";
import { MedsCard } from "./cards/MedsCard";
import { IncidentCard } from "./cards/IncidentCard";
import { NoteCard } from "./cards/NoteCard";
import { VacationCard } from "./cards/VacationCard";
import { AttachmentCard } from "./cards/AttachmentCard";
import { EncryptedItemCard } from "./cards/EncryptedItemCard";
import type { User } from '@/types/user';
import { useSecurity } from '@/context/SecurityContext';

interface TimelineItemFactoryProps {
    item: TimelineItem;
    onUpdate?: (updatedItem: TimelineItem) => void;
    onDelete?: () => void;
    user: User | null;
}

export function TimelineItemFactory({ item, onUpdate, onDelete, user }: TimelineItemFactoryProps) {
    const { isE2eeUnlocked } = useSecurity();

    // Guard: if decryption failed, show a dedicated encrypted placeholder
    if (item.encryption === "ENCRYPTED") {
        return <EncryptedItemCard item={item} hasPrivateKey={isE2eeUnlocked} />;
    }

    // After the guard, item is narrowed to PlainTimelineItem
    const plainItem: PlainTimelineItem = item;

    switch (plainItem.type) {
        case "MEDICAL_VISIT":
            return <MedicalCard item={plainItem} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "HANDOVER":
            return <HandoverCard item={plainItem} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "MEDS":
            return <MedsCard item={plainItem} onUpdate={(val) => onUpdate?.(val)} onDelete={onDelete} user={user} />;

        case "INCIDENT":
            return <IncidentCard item={plainItem} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "NOTE":
            return <NoteCard item={plainItem} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "VACATION":
            return <VacationCard item={plainItem} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "ATTACHMENT":
            return <AttachmentCard item={plainItem} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        default: {
            // TypeScript exhaustiveness check
            const _exhaustive: never = plainItem;
            void _exhaustive;
            return null;
        }
    }
}
