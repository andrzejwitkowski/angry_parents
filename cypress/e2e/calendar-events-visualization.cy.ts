describe("Calendar Events Visualization", () => {
    const getDayCell = (dayNumber: number) =>
        cy.get('.group').not('.opacity-40').contains('span', new RegExp(`^${dayNumber}$`)).closest('.group');
    const getSheet = () => cy.get('[data-testid="day-details-sheet"]');

    beforeEach(() => {
        // Set up intercepts before login/visit to capture all requests
        cy.intercept('POST', '**/api/timeline').as('createTimeline');
        cy.intercept('GET', '**/api/timeline/range*').as('fetchMonthEvents');
        cy.intercept('GET', '**/api/children*').as('fetchChildren');

        // Login directly via API
        cy.request({
            method: 'POST',
            url: 'http://localhost:3000/api/auth/login/verify',
            body: { mockLogin: true },
            headers: { 'Content-Type': 'application/json' },
        }).then((response) => {
            expect(response.status).to.eq(200);
        });

        // Visit dashboard (mock cookie set by cy.request above)
        cy.visit("http://localhost:5173/dashboard");

        // Wait for children to load via API and appear in header
        cy.wait('@fetchChildren', { timeout: 10000 });
        cy.contains('Mock Child', { timeout: 10000 }).should('be.visible');
    });

    it("should display event indicators on calendar days with events", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Open Day Details Sheet
        getDayCell(dayNumber).click();
        cy.contains("Day Logbook", { timeout: 5000 }).should("be.visible");

        // Trigger medical visit form
        getSheet().find('[data-testid="action-medical_visit"]').click({ force: true });

        // Fill medical form
        getSheet().find('[data-testid="doctor-input"]').type("Dr. Smith", { force: true });
        getSheet().find('[data-testid="diagnosis-input"]').type("Annual checkup", { force: true });
        getSheet().find('[data-testid="submit-medical"]').click({ force: true });

        // Wait for POST and calendar refetch (fired by onSuccess in LogComposer)
        cy.wait('@createTimeline');
        cy.wait('@fetchMonthEvents', { timeout: 8000 });

        // Wait for the card to appear in the timeline
        cy.contains("Medical Visit", { timeout: 5000 }).should("be.visible");

        // Close sheet via ESC
        cy.get('body').type('{esc}');
        cy.contains("Day Logbook").should("not.exist");

        // Verify event indicator appears on the calendar day cell
        getDayCell(dayNumber).within(() => {
            cy.get("button", { timeout: 6000 }).should("have.length.at.least", 1);
        });
    });

    it("should open Popover when clicking event indicator, not Day Details Sheet", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Open Day Details Sheet
        getDayCell(dayNumber).click();
        cy.contains("Day Logbook", { timeout: 5000 }).should("be.visible");

        // Add a note event
        getSheet().find('[data-testid="action-note"]').click({ force: true });
        getSheet().find('[data-testid="content-input"]').type("Popover test", { force: true });
        getSheet().find('[data-testid="submit-note"]').click({ force: true });

        cy.wait('@createTimeline');
        cy.wait('@fetchMonthEvents', { timeout: 8000 });
        cy.contains("Note", { timeout: 5000 }).should("be.visible");

        // Close sheet
        cy.get('body').type('{esc}');
        cy.contains("Day Logbook").should("not.exist");

        // Click on the last event indicator button in the day cell (use force to handle overlay)
        getDayCell(dayNumber).within(() => {
            cy.get("button", { timeout: 6000 }).last().click({ force: true });
        });

        // Verify Popover or Dialog opened
        cy.get('[role="dialog"], [role="tooltip"]', { timeout: 5000 }).should("exist");
    });

    // Helper to add a note via the DayLogbook Sheet and wait for timeline + refetch.
    const addNote = (content: string) => {
        getSheet().find('[data-testid="action-note"]').click({ force: true });
        getSheet().find('[data-testid="content-input"]').clear({ force: true }).type(content, { force: true });
        getSheet().find('[data-testid="submit-note"]').click({ force: true });
        cy.wait('@createTimeline');
        cy.wait('@fetchMonthEvents', { timeout: 10000 });
    };

    it("should show overflow indicator when day has 4+ events", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Open Day Details Sheet
        getDayCell(dayNumber).click({ force: true });
        cy.contains("Day Logbook", { timeout: 5000 }).should("be.visible");

        // Add 4 notes
        addNote("Test note 1");
        addNote("Test note 2");
        addNote("Test note 3");
        addNote("Test note 4");

        // Close sheet
        cy.get('body').type('{esc}');
        cy.contains("Day Logbook").should("not.exist");

        // Verify overflow indicator (+N button) appears
        getDayCell(dayNumber).within(() => {
            cy.contains("button", /\+\d+/, { timeout: 8000 }).should("exist");
        });
    });

    it("should open Dialog with all events when clicking overflow indicator", () => {
        const today = new Date();
        const dayNumber = today.getDate();

        // Open Day Details Sheet
        getDayCell(dayNumber).click({ force: true });
        cy.contains("Day Logbook", { timeout: 5000 }).should("be.visible");

        // Add 4 events to trigger overflow
        addNote("Event dialog test 1");
        addNote("Event dialog test 2");
        addNote("Event dialog test 3");
        addNote("Event dialog test 4");

        // Close sheet
        cy.get('body').type('{esc}');
        cy.contains("Day Logbook").should("not.exist");

        // Click the overflow +N button
        getDayCell(dayNumber).within(() => {
            cy.contains("button", /\+\d+/, { timeout: 8000 }).click({ force: true });
        });

        // The overflow dialog should open with all events
        cy.get('[role="dialog"][data-state="open"]', { timeout: 5000 }).should("be.visible");
    });

    it("should open Day Details Sheet when clicking empty area of day cell", () => {
        // Day 15 should be empty
        getDayCell(15).click();
        cy.contains("Day Logbook", { timeout: 5000 }).should("be.visible");
        cy.contains("No events yet").should("be.visible");
    });
});
