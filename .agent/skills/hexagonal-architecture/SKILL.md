---
name: Hexagonal Architecture for React + Bun
description: Senior-level guide for developing features using Hexagonal (Ports & Adapters) Architecture in a React + Bun + MongoDB stack. Covers domain modeling, port definitions, adapter patterns, dependency injection, and testing strategies.
---

# Architektura Hexagonalna — Pełny Skill Guide

> Architektura Hexagonalna (Ports & Adapters) izoluje logikę biznesową od szczegółów technicznych.
> Domena NIE wie nic o HTTP, MongoDB, ani React. Zna tylko swoje porty.

---

## 1. Mapa Warstw i Flow Zależności

```
┌─────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE                        │
│  ┌──────────────┐                   ┌──────────────────┐│
│  │   PRIMARY     │                   │    SECONDARY     ││
│  │   ADAPTERS    │                   │    ADAPTERS      ││
│  │  (Driving)    │                   │   (Driven)       ││
│  │              │                   │                  ││
│  │ Controllers  │    ┌─────────┐    │ MongoRepos       ││
│  │ HTTP Routes  │───▶│  APP    │───▶│ CryptoService    ││
│  │ WebSocket    │    │ SERVICE │    │ BlockchainAnchor ││
│  │              │    │(UseCases)│    │ InMemoryRepos    ││
│  └──────────────┘    └────┬────┘    └──────────────────┘│
│                           │                              │
│                    ┌──────▼──────┐                       │
│                    │    CORE     │                       │
│                    │  ┌───────┐  │                       │
│                    │  │DOMAIN │  │  ◄── ZERO zależności  │
│                    │  │Entities│  │      od frameworków   │
│                    │  │Values │  │                       │
│                    │  └───────┘  │                       │
│                    │  ┌───────┐  │                       │
│                    │  │ PORTS │  │  ◄── Interfejsy TS    │
│                    │  │  in/out│  │                       │
│                    │  └───────┘  │                       │
│                    └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

**Zasada zależności:** Strzałki wskazują kierunek importów. Core NIE importuje nic z adapters ani application.

---

## 2. Struktura Katalogów

```
backend/src/
├── core/                         # 🔴 SERCE — zero zależności od frameworków
│   ├── domain/                   # Encje, Value Objects, reguły biznesowe
│   │   ├── child/                # Bounded context (subdomena)
│   │   │   ├── Child.ts          # Encja
│   │   │   └── ChildRules.ts     # Reguły walidacji
│   │   ├── forensic/             # Bounded context
│   │   ├── TimelineItem.ts       # Encja + DTO
│   │   └── Passkey.ts            # Value Object
│   └── ports/                    # Interfejsy (kontrakty)
│       ├── ChildRepository.ts    # Port OUT (driven)
│       ├── TimelineRepository.ts # Port OUT + Service Port
│       ├── DateProvider.ts       # Port OUT (utility)
│       ├── UuidProvider.ts       # Port OUT (utility)
│       ├── ICryptoService.ts     # Port OUT
│       └── IBlockchainAnchor.ts  # Port OUT
├── application/                  # 🟡 USE CASES — orkiestracja
│   ├── ChildService.ts           # Implementacja use cases
│   ├── ScheduleService.ts
│   ├── TimelineService.ts
│   ├── ForensicService.ts
│   └── __tests__/                # Testy z InMemory adapterami
├── adapters/                     # 🟢 INFRASTRUKTURA
│   ├── primary/                  # Driving (wejście do systemu)
│   │   ├── ChildController.ts    # HTTP routes → wywołuje Application Service
│   │   ├── TimelineController.ts
│   │   ├── AuthController.ts
│   │   └── __tests__/
│   └── secondary/                # Driven (wyjście z systemu)
│       ├── MongoChildRepository.ts       # Implementacja produkcyjna
│       ├── InMemoryChildRepository.ts    # Implementacja testowa
│       ├── RealDateProvider.ts           # Implementacja produkcyjna
│       ├── BunCryptoService.ts
│       ├── MockBlockchainAnchor.ts       # Test double
│       └── __tests__/
├── lib/                          # Narzędzia techniczne (i18n, auth)
├── models/                       # Mongoose schemas (TYLKO w adapters!)
└── index.ts                      # Composition Root — wiring DI
```

---

## 3. Zasady dla Warstwy Domain (`core/domain/`)

### MUSISZ:
- Definiować encje jako **plain TypeScript interfaces** — bez dekoratorów, bez Mongoose
- Trzymać **reguły biznesowe** w domenie (walidacja, invarianty)
- Używać **Value Objects** dla pojęć z tożsamością wartościową (np. `Passkey`, `DateRange`)
- Grupować powiązane encje w **bounded contexts** (subdirektory: `child/`, `forensic/`)

### NIE WOLNO:
- ❌ Importować CZEGOKOLWIEK z `adapters/`, `application/`, `lib/`, ani `node_modules` (zero frameworków)
- ❌ Używać `mongoose.Schema`, `Elysia`, `Bun` API w domenie
- ❌ Umieszczać logiki persystencji (save/find) w encjach

### Wzorzec — Encja Domain:
```typescript
// core/domain/child/Child.ts
export interface Child {
    id: string;
    familyId: string;
    name: string;
    dateOfBirth: string;
    color: string;
    avatar?: string;
}
```

### Wzorzec — Value Object:
```typescript
// core/domain/Passkey.ts
export interface Passkey {
    userId: string;
    webauthnUserId: string;
    credentialID: Uint8Array;
    credentialPublicKey: Uint8Array;
    counter: number;
    transports?: string[];
    createdAt: Date;
    name: string;
}
```

---

## 4. Zasady dla Portów (`core/ports/`)

### MUSISZ:
- Definiować porty jako **TypeScript `interface`** (nigdy `class`)
- Importować TYLKO z `core/domain/` — nigdy z `adapters/`
- Dokumentować każdą metodę JSDoc
- Oddzielać **Repository Ports** (CRUD) od **Service Ports** (logika biznesowa)
- Porty utility (`DateProvider`, `UuidProvider`) powinny być minimalne

### Wzorzec — Repository Port:
```typescript
// core/ports/ChildRepository.ts
import { Child } from "../domain/child/Child";

export interface ChildRepository {
    save(child: Child): Promise<Child>;
    findAllByFamilyId(familyId: string): Promise<Child[]>;
    findById(id: string): Promise<Child | null>;
    delete(id: string): Promise<void>;
}
```

### Wzorzec — Utility Port:
```typescript
// core/ports/DateProvider.ts
export interface DateProvider {
    getNow(): Date;
    getIsoString(): string;
}

// core/ports/UuidProvider.ts
export interface UuidProvider {
    generate(): string;
}
```

---

## 5. Zasady dla Application Services (`application/`)

### MUSISZ:
- Przyjmować **wszystkie zależności przez konstruktor** (Dependency Injection)
- Typować zależności jako **porty (interfejsy)**, nigdy jako konkretne klasy
- Orkiestrować use cases — wywoływać porty w odpowiedniej kolejności
- Trzymać reguły na poziomie use case (np. „nie usuniesz dziecka z powiązanymi timeline items")

### NIE WOLNO:
- ❌ Importować konkretnych adapterów (`MongoChildRepository`, `BunCryptoService`)
- ❌ Importować frameworków HTTP (`Elysia`, `express`)
- ❌ Bezpośrednio obsługiwać request/response HTTP

### Wzorzec — Application Service:
```typescript
// application/ChildService.ts
import { Child } from "../core/domain/child/Child";
import { ChildRepository } from "../core/ports/ChildRepository";
import { TimelineRepository } from "../core/ports/TimelineRepository";
import { UuidProvider } from "../core/ports/UuidProvider";

export class ChildService {
    constructor(
        private childRepository: ChildRepository,
        private timelineRepository: TimelineRepository,
        private uuidProvider: UuidProvider
    ) {}

    async addChild(familyId: string, child: Omit<Child, "id" | "familyId">): Promise<Child> {
        const newChild: Child = {
            ...child,
            id: this.uuidProvider.generate(),
            familyId
        };
        return await this.childRepository.save(newChild);
    }

    async deleteChild(id: string): Promise<void> {
        const itemCount = await this.timelineRepository.countByChildId(id);
        if (itemCount > 0) {
            throw new Error(`Cannot delete child: ${itemCount} timeline items linked.`);
        }
        await this.childRepository.delete(id);
    }
}
```

---

## 6. Zasady dla Adapterów Primary (`adapters/primary/`)

### MUSISZ:
- Tworzyć kontrolery jako **factory functions** przyjmujące Application Service
- Mapować HTTP request → wywołanie serwisu → HTTP response
- Obsługiwać błędy i kody statusu na tym poziomie
- Walidować input z HTTP (body, params, query) przed przekazaniem do serwisu

### Wzorzec — Primary Adapter (Controller):
```typescript
// adapters/primary/ChildController.ts
import { Elysia } from "elysia";
import { ChildService } from "../../application/ChildService";

export const createChildController = (childService: ChildService) => {
    return new Elysia({ prefix: "/api/children" })
        .get("/", async ({ query }) => {
            const { familyId } = query as { familyId: string };
            return await childService.getAllChildren(familyId);
        })
        .post("/", async ({ body, set }) => {
            try {
                const { familyId, ...childData } = body as any;
                const child = await childService.addChild(familyId, childData);
                set.status = 201;
                return child;
            } catch (error) {
                set.status = 400;
                return { error: (error as Error).message };
            }
        });
};
```

---

## 7. Zasady dla Adapterów Secondary (`adapters/secondary/`)

### MUSISZ:
- Implementować port interface z użyciem `implements`
- Tworzyć **InMemory** adapter dla testów + **Mongo** adapter dla produkcji
- Trzymać szczegóły Mongoose/MongoDB TYLKO w tym katalogu
- Mapować między Mongoose documents a domain entities

### Wzorzec — Secondary Adapter (MongoDB):
```typescript
// adapters/secondary/MongoChildRepository.ts
import { Child } from "../../core/domain/child/Child";
import { ChildRepository } from "../../core/ports/ChildRepository";
import { ChildModel } from "../../models/ChildModel";

export class MongoChildRepository implements ChildRepository {
    async save(child: Child): Promise<Child> {
        const doc = await ChildModel.findOneAndUpdate(
            { id: child.id },
            child,
            { upsert: true, new: true }
        );
        return this.toDomain(doc);
    }

    async findById(id: string): Promise<Child | null> {
        const doc = await ChildModel.findOne({ id });
        return doc ? this.toDomain(doc) : null;
    }

    private toDomain(doc: any): Child {
        return { id: doc.id, familyId: doc.familyId, name: doc.name, /* ... */ };
    }
}
```

### Wzorzec — Secondary Adapter (InMemory dla testów):
```typescript
// adapters/secondary/InMemoryChildRepository.ts
import { Child } from "../../core/domain/child/Child";
import { ChildRepository } from "../../core/ports/ChildRepository";

export class InMemoryChildRepository implements ChildRepository {
    private children: Map<string, Child> = new Map();

    async save(child: Child): Promise<Child> {
        this.children.set(child.id, { ...child });
        return child;
    }

    async findById(id: string): Promise<Child | null> {
        return this.children.get(id) || null;
    }

    clear(): void {
        this.children.clear();
    }
}
```

### Wzorzec — Utility Adapter:
```typescript
// adapters/secondary/RealDateProvider.ts
import { DateProvider } from "../core/ports/DateProvider";

export class RealDateProvider implements DateProvider {
    getNow(): Date { return new Date(); }
    getIsoString(): string { return new Date().toISOString(); }
}
```

---

## 8. Composition Root (`index.ts`)

Jedyne miejsce, gdzie **konkretne klasy** są instancjonowane i wiązane:

```typescript
// index.ts — Composition Root
// 1. Repositories (secondary adapters)
const childRepository = new MongoChildRepository();
const timelineRepository = new MongoTimelineRepository();
const dateProvider = new RealDateProvider();
const uuidProvider = new RealUuidProvider();

// 2. Application Services (use cases)
const childService = new ChildService(childRepository, timelineRepository, uuidProvider);

// 3. Controllers (primary adapters)
const childController = createChildController(childService);

// 4. Wire to Elysia
app.use(childController);
```

**Zasada:** `index.ts` to JEDYNY plik, który zna wszystkie konkretne implementacje.

---

## 9. Strategia Testowania Hexagonalnego

### A. Unit Testy Domeny (bun:test)
- **Zero mocków** — domena nie ma zależności
- Testuj reguły biznesowe, walidacje, invarianty
```typescript
import { describe, it, expect } from "bun:test";

describe("Child domain rules", () => {
    it("should require a name", () => {
        expect(() => validateChild({ name: "" })).toThrow();
    });
});
```

### B. Unit Testy Application Services (bun:test + InMemory adapters)
- Używaj **InMemory** adapterów zamiast mocków
- Testuj orkiestrację use cases
```typescript
import { describe, it, expect } from "bun:test";

describe("ChildService", () => {
    const childRepo = new InMemoryChildRepository();
    const timelineRepo = new InMemoryTimelineRepository();
    const uuidProvider = { generate: () => "test-uuid" };
    const service = new ChildService(childRepo, timelineRepo, uuidProvider);

    it("should create a child with generated ID", async () => {
        const child = await service.addChild("family-1", { name: "Jan", dateOfBirth: "2020-01-01", color: "#ff0000" });
        expect(child.id).toBe("test-uuid");
        expect(child.familyId).toBe("family-1");
    });

    it("should not delete child with linked timeline items", async () => {
        // setup: add child + timeline item
        expect(service.deleteChild("child-1")).rejects.toThrow("timeline items linked");
    });
});
```

### C. Integration Testy (Cypress)
- Testuj pełny flow HTTP → Controller → Service → Repository
- Jeden plik na feature

### D. Contract Testy Adapterów
- Testuj, że adapter spełnia kontrakt portu
- Użyj shared test suite na InMemory i Mongo adapter

---

## 10. Anti-Patterny — Czego NIE Robić ❌

| ❌ Anti-Pattern | ✅ Poprawne Rozwiązanie |
|---|---|
| Import `MongoChildRepo` w `ChildService` | Typuj zależność jako `ChildRepository` (port) |
| `new Date()` bezpośrednio w serwisie | Użyj `DateProvider` port |
| `crypto.randomUUID()` w domenie | Użyj `UuidProvider` port |
| `console.log()` w serwisach | Użyj structured logger przez port |
| Mongoose schema w `core/domain/` | Mongoose TYLKO w `adapters/secondary/` |
| HTTP status codes w Application Service | Status codes TYLKO w `adapters/primary/` |
| Business logic w Controller | Controller to TYLKO mapowanie HTTP ↔ Service |
| Tworzenie adaptera bez portu | Najpierw port (interface), potem adapter (impl) |

---

## 11. Checklist: Dodawanie Nowej Feature

Kolejność implementacji (bottom-up):

- [ ] **1. Domain Entity** — `core/domain/[feature]/Entity.ts` — plain interface
- [ ] **2. Port Interface** — `core/ports/[Feature]Repository.ts` — kontrakt
- [ ] **3. InMemory Adapter** — `adapters/secondary/InMemory[Feature]Repository.ts` — do testów
- [ ] **4. Unit Testy Domeny** — `core/domain/[feature]/__tests__/` — zero zależności
- [ ] **5. Application Service** — `application/[Feature]Service.ts` — use cases z DI
- [ ] **6. Unit Testy Serwisu** — `application/__tests__/[Feature]Service.test.ts` — z InMemory
- [ ] **7. Mongo Adapter** — `adapters/secondary/Mongo[Feature]Repository.ts` — implementacja prod
- [ ] **8. Mongoose Model** — `models/[Feature].ts` — schema
- [ ] **9. Primary Adapter** — `adapters/primary/[Feature]Controller.ts` — HTTP routes
- [ ] **10. Composition Root** — `index.ts` — wiring nowych zależności
- [ ] **11. i18n Keys** — dodaj klucze tłumaczeń
- [ ] **12. Cypress E2E** — `cypress/e2e/[feature].cy.ts` — test pełnego flow
- [ ] **13. Frontend Component** — React component korzystający z API
- [ ] **14. Manual Test** — weryfikacja w przeglądarce

---

## 12. Dependency Injection — Zasady

1. **Constructor Injection** — zawsze przez konstruktor, nigdy property injection
2. **Typuj na interfejs** — `private repo: ChildRepository` (port), NIGDY `MongoChildRepository`
3. **Composition Root** — jedyne miejsce z `new ConcreteClass()`
4. **Brak kontenera DI** — manual wiring w `index.ts` (prostota nad abstrakcję)
5. **Fabryki kontrolerów** — `createXController(service)` jako factory function

---

## 13. Frontend a Hexagonal Architecture

Frontend (React) komunikuje się z backendem przez HTTP API. Na frontendzie stosujemy uproszczoną wersję separacji:

```
src/
├── lib/api/           # Klient HTTP — adapter wyjściowy
├── hooks/             # Custom hooks — logika UI
├── components/        # Prezentacja — shadcn/ui + Tailwind
├── pages/             # Orkiestracja route'ów
└── types/             # Współdzielone typy (mogą być importowane z backend/core/domain)
```

**Zasada:** Komponenty React NIE wywołują `fetch` bezpośrednio. Używamy `lib/api/` klienta jako warstwy abstrakcji.
