export const RegistrationStatus = {
    FLOW_STARTED: "FLOW_STARTED",
    PARENT_A_VALIDATED: "PARENT_A_VALIDATED",
    INVITATION_SENT: "INVITATION_SENT",
    EMAIL_READ: "EMAIL_READ",
    EMAIL_FAILED: "EMAIL_FAILED",
    PARENT_B_REGISTERED: "PARENT_B_REGISTERED",
    COMPLETED: "COMPLETED",
} as const;

export type RegistrationStatus = typeof RegistrationStatus[keyof typeof RegistrationStatus];

export const REGISTRATION_STATUS_ORDER: RegistrationStatus[] = [
    RegistrationStatus.FLOW_STARTED,
    RegistrationStatus.PARENT_A_VALIDATED,
    RegistrationStatus.INVITATION_SENT,
    RegistrationStatus.EMAIL_READ,
    RegistrationStatus.PARENT_B_REGISTERED,
    RegistrationStatus.COMPLETED,
];

export const REGISTRATION_STATUS_CONFIG: Record<RegistrationStatus, { color: string; icon: string }> = {
    [RegistrationStatus.FLOW_STARTED]: { color: "blue", icon: "Play" },
    [RegistrationStatus.PARENT_A_VALIDATED]: { color: "indigo", icon: "UserCheck" },
    [RegistrationStatus.INVITATION_SENT]: { color: "purple", icon: "Mail" },
    [RegistrationStatus.EMAIL_READ]: { color: "cyan", icon: "MailOpen" },
    [RegistrationStatus.EMAIL_FAILED]: { color: "red", icon: "MailX" },
    [RegistrationStatus.PARENT_B_REGISTERED]: { color: "pink", icon: "UserPlus" },
    [RegistrationStatus.COMPLETED]: { color: "green", icon: "CheckCircle2" },
};

export const ParentRegistrationStatus = {
    INVITATION_SENT: "INVITATION_SENT",
    EMAIL_OPENED: "EMAIL_OPENED",
    REGISTERED: "REGISTERED",
} as const;

export type ParentRegistrationStatus = typeof ParentRegistrationStatus[keyof typeof ParentRegistrationStatus];

export const PARENT_REGISTRATION_STATUS_ORDER: ParentRegistrationStatus[] = [
    ParentRegistrationStatus.INVITATION_SENT,
    ParentRegistrationStatus.EMAIL_OPENED,
    ParentRegistrationStatus.REGISTERED,
];

export const PARENT_REGISTRATION_STATUS_CONFIG: Record<ParentRegistrationStatus, { color: string; icon: string }> = {
    [ParentRegistrationStatus.INVITATION_SENT]: { color: "purple", icon: "Mail" },
    [ParentRegistrationStatus.EMAIL_OPENED]: { color: "cyan", icon: "MailOpen" },
    [ParentRegistrationStatus.REGISTERED]: { color: "green", icon: "CheckCircle2" },
};
