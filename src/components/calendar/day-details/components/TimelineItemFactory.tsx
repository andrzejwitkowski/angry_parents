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
    onUpdate?: (updatedItem: TimelineItem) => void;
}

export function TimelineItemFactory({ item, onUpdate }: TimelineItemFactoryProps) {
    switch (item.type) {
        case "MEDICAL_VISIT":
            return <MedicalCard item={item} />;

        case "HANDOVER":
            return <HandoverCard item={item} />;

        case "MEDS":
            return <MedsCard item={item} onUpdate={onUpdate} />;

        case "INCIDENT":
            return <IncidentCard item={item} />;

        case "NOTE":
            return <NoteCard item={item} />;

        case "VACATION":
            return <VacationCard item={item} />;

        case "ATTACHMENT":
            return <AttachmentCard item={item} />;

        default:
            // TypeScript exhaustiveness check
            const _exhaustive: never = item;
            return null;
    }
}
