describe("Calendar Events Visualization", () => {
    beforeEach(() => {
        // Visit the app and ensure we're logged in
        cy.visit("http://localhost:5173");

        // Register or login
        cy.get('input[type="email"]').type("test@example.com");
        cy.get('button').contains('Dev: Simulate Login', { matchCase: false }).click();

        // Wait for dashboard to load
        cy.url({ timeout: 10000 }).should('include', '/dashboard');
    });
    const getDayCell = (dayNumber: number) => cy.get('.group').not('.opacity-40').contains('span', new RegExp(`^${dayNumber}$`)).closest('.group');

    it("should display event indicators on calendar days with events", () => {
        // First, add an event
        const today = new Date();
        const dayNumber = today.getDate();

        // Open Day Details Sheet
        getDayCell(dayNumber).click();

        // Wait for Day Details Sheet to open
        cy.contains("Day Logbook").should("be.visible");

        // Add a Medical Visit
        cy.get('[role="dialog"][data-state="open"]').last().within(() => {
            cy.get('[data-testid="action-medical_visit"]').click({ force: true });
            cy.get('[data-testid="child-badge"]').first().click({ force: true });
            cy.get('[data-testid="doctor-input"]').type("Dr. Smith", { force: true });
            cy.get('[data-testid="diagnosis-input"]').type("Annual checkup", { force: true });
            cy.get('[data-testid="submit-medical"]').click({ force: true });
        });

        // Wait for the item to be added
        cy.contains("Dr. Smith", { timeout: 5000 }).should("be.visible");

        // Close the sheet
        cy.get('[role="dialog"][data-state="open"]').last().type("{esc}");
        cy.contains("Day Logbook").should("not.exist");

        // Verify event indicator appears on the calendar
        getDayCell(dayNumber)
            .within(() => {
                // Should have an event indicator (icon button)
                cy.get("button").should("have.length.at.least", 1);
            });
    });

    it("should open Popover when clicking event indicator, not Day Details Sheet", () => {
        // First, add an event
        const today = new Date();
        const dayNumber = today.getDate();

        getDayCell(dayNumber).click();

        cy.contains("Day Logbook").should("be.visible");

        // Add a Note
        cy.get('[role="dialog"][data-state="open"]').last().within(() => {
            cy.get('[data-testid="action-note"]').click({ force: true });
            cy.get('[data-testid="child-badge"]').first().click({ force: true });
            cy.get('[data-testid="content-input"]').type("Test note for popover", { force: true });
            cy.get('[data-testid="submit-note"]').click({ force: true });
        });

        cy.contains("Test note for popover", { timeout: 5000 }).should("be.visible");

        // Close the sheet
        cy.get('[role="dialog"][data-state="open"]').last().type("{esc}");
        cy.contains("Day Logbook").should("not.exist");

        // Click on the event indicator (small button)
        getDayCell(dayNumber)
            .within(() => {
                cy.get("button").last().click();
                // Radix UI adds data-state="open" to the trigger when the popover opens
                cy.get("button").last().should("have.attr", "data-state", "open");
            });

        // Verify Popover opens in portal
        cy.get('[role="dialog"]').should("exist");
    });

    it("should show overflow indicator when day has 4+ events", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Open Day Details Sheet
        getDayCell(dayNumber).click({ force: true });

        cy.contains("Day Logbook").should("be.visible");

        // Add 4 events
        cy.get('[role="dialog"][data-state="open"]').last().within(() => {
            for (let i = 1; i <= 4; i++) {
                cy.get('[data-testid="action-note"]').click({ force: true });
                cy.get('[data-testid="child-badge"]').first().click({ force: true });
                cy.get('[data-testid="content-input"]').clear({ force: true }).type(`Test note ${i}`, { force: true });
                cy.get('[data-testid="submit-note"]').click({ force: true });
                cy.wait(500); // Wait for item to be added
            }
        });

        // Close the sheet
        cy.get('[role="dialog"][data-state="open"]').last().type("{esc}");
        cy.contains("Day Logbook").should("not.exist");

        // Verify overflow indicator appears ("+N" button)
        getDayCell(dayNumber)
            .within(() => {
                // Should have overflow button with "+1" or similar
                cy.contains("button", /\+\d+/).should("exist");
            });
    });

    it("should open Dialog with all events when clicking overflow indicator", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Open Day Details Sheet and add 5 events
        getDayCell(dayNumber).click({ force: true });

        cy.contains("Day Logbook").should("be.visible");

        cy.get('[role="dialog"][data-state="open"]').last().within(() => {
            for (let i = 1; i <= 5; i++) {
                cy.get('[data-testid="action-note"]').click({ force: true });
                cy.get('[data-testid="child-badge"]').first().click({ force: true });
                cy.get('[data-testid="content-input"]').clear({ force: true }).type(`Event ${i}`, { force: true });
                cy.get('[data-testid="submit-note"]').click({ force: true });
                cy.wait(500);
            }
        });

        cy.get('[role="dialog"][data-state="open"]').last().type("{esc}");
        cy.contains("Day Logbook").should("not.exist");

        // Click overflow indicator
        getDayCell(dayNumber)
            .within(() => {
                cy.contains("button", /\+\d+/).click({ force: true });
            });

        // Verify Dialog opens with all events
        cy.contains("Events on").should("be.visible");

        // Should show all 5 events
        cy.contains("Event 1").should("exist");
        cy.contains("Event 5").should("exist");
    });

    it("should open Day Details Sheet when clicking empty area of day cell", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Click on the day number (not on any event indicator)
        getDayCell(dayNumber)
            .find("span")
            .contains(dayNumber.toString())
            .click({ force: true });

        // Verify Day Details Sheet opens
        cy.contains("Day Logbook").should("be.visible");
    });
});
