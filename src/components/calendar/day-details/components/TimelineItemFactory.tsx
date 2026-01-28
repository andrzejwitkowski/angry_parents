import type { TimelineItem } from "@/types/timeline.types";
import { MedicalCard } from "./cards/MedicalCard";
import { HandoverCard } from "./cards/HandoverCard";
import { MedsCard } from "./cards/MedsCard";
import { IncidentCard } from "./cards/IncidentCard";
import { NoteCard } from "./cards/NoteCard";
import { VacationCard } from "./cards/VacationCard";
import { AttachmentCard } from "./cards/AttachmentCard";

interface TimelineItemFactoryProps {
    item: TimelineItem;
    onUpdate?: (updatedItem?: any) => void;
    user: any;
}

export function TimelineItemFactory({ item, onUpdate, user }: TimelineItemFactoryProps) {
    switch (item.type) {
        case "MEDICAL_VISIT":
            return <MedicalCard item={item} user={user} onUpdate={onUpdate} />;

        case "HANDOVER":
            return <HandoverCard item={item} user={user} onUpdate={onUpdate} />;

        case "MEDS":
            return <MedsCard item={item} onUpdate={(val) => onUpdate?.(val)} user={user} />;

        case "INCIDENT":
            return <IncidentCard item={item} user={user} onUpdate={onUpdate} />;

        case "NOTE":
            return <NoteCard item={item} user={user} onUpdate={onUpdate} />;

        case "VACATION":
            return <VacationCard item={item} user={user} onUpdate={onUpdate} />;

        case "ATTACHMENT":
            return <AttachmentCard item={item} user={user} onUpdate={onUpdate} />;

        default:
            // TypeScript exhaustiveness check
            const _exhaustive: never = item;
            return null;
    }
}
