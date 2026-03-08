# Backend structure after refactor (issue #24)

```text
backend/src/
├── adapters/
│   ├── blockchain/
│   │   ├── MockBlockchainAnchor.ts
│   │   └── ViemBlockchainAnchor.ts
│   ├── mongo/
│   │   ├── __tests__/
│   │   │   └── mongoMemoryServer.ts
│   │   ├── inmemory/
│   │   │   ├── auth/
│   │   │   │   ├── InMemoryPasskeyRepository.ts
│   │   │   │   └── InMemoryRegistrationProcessRepository.ts
│   │   │   ├── events/
│   │   │   │   ├── InMemoryCustodyRepository.ts
│   │   │   │   ├── InMemoryScheduleRepository.ts
│   │   │   │   ├── InMemoryTimelineRepository.ts
│   │   │   │   └── __tests__/
│   │   │   │       └── InMemoryTimelineRepository.test.ts
│   │   │   ├── family/
│   │   │   │   └── InMemoryChildRepository.ts
│   │   │   └── forensic/
│   │   │       └── InMemoryForensicIntentRepository.ts
│   │   ├── models/
│   │   │   ├── ChildModel.ts
│   │   │   ├── CustodyEntryModel.ts
│   │   │   ├── FamilyModel.ts
│   │   │   ├── ForensicIntentModel.ts
│   │   │   ├── InvitationModel.ts
│   │   │   ├── PasskeyModel.ts
│   │   │   ├── RegistrationProcessModel.ts
│   │   │   ├── ScheduleRuleModel.ts
│   │   │   └── TimelineItemModel.ts
│   │   └── repositories/
│   │       ├── auth/
│   │       │   ├── MongoPasskeyRepository.ts
│   │       │   ├── MongoRegistrationProcessRepository.ts
│   │       │   └── __tests__/
│   │       │       ├── MongoPasskeyRepository.test.ts
│   │       │       ├── MongoRegistrationProcessRepository.test.ts
│   │       │       └── PasskeyRepository.contract.test.ts
│   │       ├── events/
│   │       │   ├── MongoCustodyRepository.ts
│   │       │   ├── MongoScheduleRepository.ts
│   │       │   ├── MongoTimelineRepository.ts
│   │       │   └── __tests__/
│   │       │       ├── MongoCustodyRepository.test.ts
│   │       │       ├── MongoScheduleRepository.test.ts
│   │       │       └── MongoTimelineRepository.test.ts
│   │       ├── family/
│   │       │   ├── MongoChildRepository.ts
│   │       │   └── __tests__/
│   │       │       └── MongoChildRepository.test.ts
│   │       └── forensic/
│   │           ├── MongoForensicIntentRepository.ts
│   │           ├── MongoForensicRepository.ts
│   │           └── __tests__/
│   │               └── MongoForensicRepository.test.ts
│   ├── observability/
│   │   └── JsonLoggerObservability.ts
│   ├── rest/
│   │   ├── auth/
│   │   │   ├── AuthController.ts
│   │   │   ├── AdminController.ts
│   │   │   ├── WebAuthnController.ts
│   │   │   └── __tests__/
│   │   │       └── AdminController.test.ts
│   │   ├── common/
│   │   │   ├── authContext.ts
│   │   │   └── errorMapper.ts
│   │   ├── events/
│   │   │   ├── CustodyController.ts
│   │   │   ├── TimelineController.ts
│   │   │   └── __tests__/
│   │   │       ├── TimelineController.test.ts
│   │   │       └── TimelineControllerError.test.ts
│   │   ├── family/
│   │   │   └── ChildController.ts
│   │   └── forensic/
│   │       └── ForensicController.ts
│   └── security/
│       └── BunCryptoService.ts
├── assets/
├── config/
│   ├── createApp.ts
│   ├── registerSchedulerHandlers.ts
│   └── wireDependencies.ts
├── domain/
│   ├── auth/
│   │   ├── model/
│   │   │   └── Passkey.ts
│   │   └── ports/
│   │       └── PasskeyRepository.ts
│   ├── events/
│   │   ├── service/
│   │   │   ├── CustodyApiService.ts
│   │   │   ├── CustodyGenerator.ts
│   │   │   ├── PropagationService.ts
│   │   │   ├── ScheduleService.ts
│   │   │   ├── TimelineApiService.ts
│   │   │   ├── TimelineService.ts
│   │   │   └── __tests__/
│   │   │       ├── TimelineAudit.test.ts
│   │   │       ├── TimelineForensic.test.ts
│   │   │       ├── TimelineService.test.ts
│   │   │       └── TimelineServiceTimezone.test.ts
│   │   ├── model/
│   │   │   ├── TimelineItem.ts
│   │   │   └── child/
│   │   │       ├── ConflictService.ts
│   │   │       ├── CustodyEntry.ts
│   │   │       ├── CustodyPatternConfig.ts
│   │   │       ├── ScheduleRule.ts
│   │   │       ├── TimeUtils.ts
│   │   │       └── strategies/
│   │   │           ├── AlternatingWeekendStrategy.ts
│   │   │           ├── CustomBlockStrategy.ts
│   │   │           ├── CustomSequenceStrategy.ts
│   │   │           ├── CustodyStrategy.ts
│   │   │           ├── GapFillStrategy.ts
│   │   │           ├── HolidayStrategy.ts
│   │   │           └── __tests__/
│   │   │               ├── AlternatingWeekendStrategy.test.ts
│   │   │               ├── CustomBlockStrategy.test.ts
│   │   │               └── GapFillStrategy.test.ts
│   │   └── ports/
│   │       ├── CustodyRepository.ts
│   │       ├── ScheduleRepository.ts
│   │       └── TimelineRepository.ts
│   ├── family/
│   │   ├── service/
│   │   │   ├── ChildService.ts
│   │   │   ├── FamilyApiService.ts
│   │   │   └── __tests__/
│   │   │       └── ChildDeletion.test.ts
│   │   ├── model/
│   │   │   └── Child.ts
│   │   └── ports/
│   │       └── ChildRepository.ts
│   ├── forensic/
│   │   ├── service/
│   │   │   ├── ForensicApiService.ts
│   │   │   └── ForensicService.ts
│   │   ├── model/
│   │   │   ├── ForensicChain.ts
│   │   │   ├── ForensicDocument.ts
│   │   │   └── SystemState.ts
│   │   └── ports/
│   │       ├── ForensicIntentRepository.ts
│   │       └── IForensicRepository.ts
│   └── shared/
│       ├── ports/
│       │   ├── DateProvider.ts
│       │   ├── IBlockchainAnchor.ts
│       │   ├── ICryptoService.ts
│       │   ├── ObservabilityService.ts
│       │   ├── TaskScheduler.ts
│       │   └── UuidProvider.ts
│       └── types/
│           └── SessionUser.ts
├── lib/
├── scheduler/
├── shared/
│   └── providers/
│       ├── RealDateProvider.ts
│       └── RealUuidProvider.ts
└── index.ts
```

## Notes

- REST controllers remain under `adapters/rest/*`.
- Dependency wiring and app assembly are moved to `config/*`.
- Former `core/*` and `application/*` are merged into per-context `domain/*/{model,ports,service}`.
- Mongo and InMemory adapters stay grouped under `adapters/mongo/*`.
- Full test suite passes after migration (`bun run test:all`).
