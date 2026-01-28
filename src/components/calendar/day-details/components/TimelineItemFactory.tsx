import type { TimelineItem } from "@/types/timeline.types";
import { MedicalCard } from "./cards/MedicalCard";
import { HandoverCard } from "./cards/HandoverCard";
import { MedsCard } from "./cards/MedsCard";
import { IncidentCard } from "./cards/IncidentCard";
import { NoteCard } from "./cards/NoteCard";
import { VacationCard } from "./cards/VacationCard";
import { AttachmentCard } from "./cards/AttachmentCard";
import type { User } from '@/types/user';

interface TimelineItemFactoryProps {
    item: TimelineItem;
    onUpdate?: (updatedItem: TimelineItem) => void;
    onDelete?: () => void;
    user: User | null;
}

export function TimelineItemFactory({ item, onUpdate, onDelete, user }: TimelineItemFactoryProps) {
    switch (item.type) {
        case "MEDICAL_VISIT":
            return <MedicalCard item={item} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "HANDOVER":
            return <HandoverCard item={item} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "MEDS":
            return <MedsCard item={item} onUpdate={(val) => onUpdate?.(val)} onDelete={onDelete} user={user} />;

        case "INCIDENT":
            return <IncidentCard item={item} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "NOTE":
            return <NoteCard item={item} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "VACATION":
            return <VacationCard item={item} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        case "ATTACHMENT":
            return <AttachmentCard item={item} user={user} onUpdate={onUpdate} onDelete={onDelete} />;

        default:
            // TypeScript exhaustiveness check
            // @ts-ignore
            const _exhaustive: never = item;
            return null;
    }
}
