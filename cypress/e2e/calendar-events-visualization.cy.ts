describe("Calendar Events Visualization", () => {
    beforeEach(() => {
        // Visit the app and ensure we're logged in
        cy.visit("http://localhost:5173");

        // Register or login
        cy.get('input[type="email"]').type("test@example.com");
        cy.get('input[type="password"]').type("password123");
        cy.contains("button", /sign in|log in/i).click();

        // Wait for calendar to load
        cy.contains("Calendar", { timeout: 10000 }).should("be.visible");
    });

    it("should display event indicators on calendar days with events", () => {
        // Get today's date cell
        const today = new Date();
        const dayNumber = today.getDate();

        // Click on today's date to open Day Details Sheet
        cy.contains(".min-h-\\[140px\\]", dayNumber.toString())
            .first()
            .click();

        // Wait for Day Details Sheet to open
        cy.contains("Day Logbook").should("be.visible");

        // Add a Medical Visit
        cy.contains("button", /medical/i).click();
        cy.get('input[placeholder*="doctor" i], input[name*="doctor" i]')
            .type("Dr. Smith");
        cy.get('input[placeholder*="diagnosis" i], input[name*="diagnosis" i], textarea[placeholder*="diagnosis" i]')
            .type("Annual checkup");
        cy.contains("button", /add|save|submit/i).click();

        // Wait for the item to be added
        cy.contains("Dr. Smith", { timeout: 5000 }).should("be.visible");

        // Close the sheet
        cy.get('[data-state="open"]').type("{esc}");

        // Verify event indicator appears on the calendar
        cy.contains(".min-h-\\[140px\\]", dayNumber.toString())
            .first()
            .within(() => {
                // Should have an event indicator (icon button)
                cy.get("button").should("have.length.at.least", 1);
            });
    });

    it("should open Popover when clicking event indicator, not Day Details Sheet", () => {
        // First, add an event
        const today = new Date();
        const dayNumber = today.getDate();

        cy.contains(".min-h-\\[140px\\]", dayNumber.toString())
            .first()
            .click();

        cy.contains("Day Logbook").should("be.visible");

        // Add a Note
        cy.contains("button", /note/i).click();
        cy.get('textarea[placeholder*="note" i], textarea[name*="content" i]')
            .type("Test note for popover");
        cy.contains("button", /add|save|submit/i).click();

        cy.contains("Test note for popover", { timeout: 5000 }).should("be.visible");

        // Close the sheet
        cy.get('[data-state="open"]').type("{esc}");

        // Wait for sheet to close
        cy.contains("Day Logbook").should("not.exist");

        // Click on the event indicator (small button)
        cy.contains(".min-h-\\[140px\\]", dayNumber.toString())
            .first()
            .within(() => {
                cy.get("button").first().click({ force: true });
            });

        // Verify Popover opens (should show event details in a small popup)
        // The popover should contain event info but NOT "Day Logbook" title
        cy.get('[role="dialog"]').should("not.contain", "Day Logbook");

        // Should show some event content
        cy.contains("Test note", { timeout: 3000 }).should("be.visible");
    });

    it("should show overflow indicator when day has 4+ events", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Open Day Details Sheet
        cy.contains(".min-h-\\[140px\\]", dayNumber.toString())
            .first()
            .click();

        cy.contains("Day Logbook").should("be.visible");

        // Add 4 events
        for (let i = 1; i <= 4; i++) {
            cy.contains("button", /note/i).click();
            cy.get('textarea[placeholder*="note" i], textarea[name*="content" i]')
                .clear()
                .type(`Test note ${i}`);
            cy.contains("button", /add|save|submit/i).click();
            cy.wait(500); // Wait for item to be added
        }

        // Close the sheet
        cy.get('[data-state="open"]').type("{esc}");

        // Verify overflow indicator appears ("+N" button)
        cy.contains(".min-h-\\[140px\\]", dayNumber.toString())
            .first()
            .within(() => {
                // Should have overflow button with "+1" or similar
                cy.contains("button", /\+\d+/).should("be.visible");
            });
    });

    it("should open Dialog with all events when clicking overflow indicator", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Open Day Details Sheet and add 5 events
        cy.contains(".min-h-\\[140px\\]", dayNumber.toString())
            .first()
            .click();

        cy.contains("Day Logbook").should("be.visible");

        for (let i = 1; i <= 5; i++) {
            cy.contains("button", /note/i).click();
            cy.get('textarea[placeholder*="note" i], textarea[name*="content" i]')
                .clear()
                .type(`Event ${i}`);
            cy.contains("button", /add|save|submit/i).click();
            cy.wait(500);
        }

        cy.get('[data-state="open"]').type("{esc}");

        // Click overflow indicator
        cy.contains(".min-h-\\[140px\\]", dayNumber.toString())
            .first()
            .within(() => {
                cy.contains("button", /\+\d+/).click({ force: true });
            });

        // Verify Dialog opens with all events
        cy.contains("Events on").should("be.visible");

        // Should show all 5 events
        cy.contains("Event 1").should("be.visible");
        cy.contains("Event 5").should("be.visible");
    });

    it("should open Day Details Sheet when clicking empty area of day cell", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Click on the day number (not on any event indicator)
        cy.contains(".min-h-\\[140px\\]", dayNumber.toString())
            .first()
            .find("span")
            .contains(dayNumber.toString())
            .click();

        // Verify Day Details Sheet opens
        cy.contains("Day Logbook").should("be.visible");
    });
});
