/// <reference types="cypress" />
describe('Custody Visualization', () => {
    beforeEach(() => {
        cy.viewport(1280, 720);
        // Login flow
        cy.visit('/auth');
        cy.contains('Register').click();
        const suffix = Date.now();
        cy.get('input[placeholder="John Doe"]').type(`Vis User ${suffix}`);
        cy.get('input[placeholder="johndoe"]').type(`visuser${suffix}`);
        cy.get('input[placeholder="name@example.com"]').type(`visuser${suffix}@test.com`);
        cy.get('input[type="password"]').first().type('password123');
        cy.get('button[type="submit"]').click();

        // Clear existing custody to be safe? 
        // We lack a clear button on UI but we can rely on fresh user logic or just overwrite.
    });

    it('Scenario: Generate & View', () => {
        // 1. Open Wizard
        cy.contains('button', 'Generate Schedule').click({ force: true });

        // 2. Configure "Alt Weekend"
        cy.get('[role="dialog"]').should('be.visible');
        cy.get('[role="dialog"]').contains('Alt. Weekend').click();

        // Set dates: Start current month 1st, End current month 28th.
        const now = new Date();
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-28`;

        cy.get('[role="dialog"]').contains('Start Date').parent().find('input').type(start);
        cy.get('[role="dialog"]').contains('End Date').parent().find('input').type(end);

        // Handover time: 18:00 (to trigger split day visualization if start/end match handover)
        // Alt Weekend Strategy usually generates full days for MOM/DAD, but let's check if we can force split.
        // Or just trust the Generator logic. Generator usually outputs 00:00-23:59 unless specific handover logic logic is active.
        // The implementation of AltWeekendStrategy usually does FULL days. 
        // However, we want to test VISUALIZATION of split days.
        // We might need to manually inject a split day/timeline event?
        // Or using "Custom Loop" does it split? No.

        // For now, let's verify SOLID colors first.
        cy.get('[role="dialog"]').contains('button', 'Generate Schedule').click({ force: true });
        cy.wait(500); // wait for generation (client side)

        // 3. Save
        cy.wait(500); // Wait for preview to render
        cy.get('[role="dialog"]').contains('button', 'Save').should('be.visible').click();

        // Expect dialog to close (we implemented this in Dashboard)
        cy.get('[role="dialog"]').should('not.exist');

        // 4. Verification on Calendar Grid
        // Wait for fetch
        cy.wait(1000);

        // Verify we have custody events
        // Note: The strategy generates full days mostly, but Monday might be split if we use the new logic.
        // Let's just check for existence of 'day-cell-background' on the start date or near it.
        // Start date was 1st.
        const dayNumber = new Date(start).getDate();
        cy.contains('span', dayNumber.toString()).closest('div').within(() => {
            // We can't guarantee a background on 1st if Parent matches Default... 
            // actually Alternating Weekend starts with "Weekend Parent".
            // If Starting Parent = DAD (default in wizard?).
            // Let's check for ANY day-cell-background.
        });

        // Check Monday (Day 5 if start is Mon? No, test sets Start Date = Start of Month)
        // Let's check generally that backgrounds exist.
        cy.get('[data-testid="day-cell-background"]').should('exist');

        // Check Monday (Day 5) - Expected Split Day
        // We expect MOM and DAD labels in the same cell if it's split.
        cy.contains('span', '5').closest('.group').scrollIntoView().within(() => {
            cy.contains('MOM').should('exist');
            cy.contains('DAD').should('exist');
        });

        // Single Day Check (e.g. Day 6 -> MOM)
        // Only MOM should be visible
        cy.contains('span', '6').closest('.group').scrollIntoView().within(() => {
            cy.contains('MOM').should('exist');
            cy.contains('DAD').should('not.exist');
        });

        // Advanced: Check for split day (Monday likely, if Monday is return day).
        // If handover is 18:00 (from previous step input), Monday should be split at 18:00.
        // But the previous step says: "Handover time: 18:00 ...".
        // Let's inspect a likely Monday cell. Jan 2026 -> Mon 5th.
        // cy.contains('span', '5').closest('div').find('[data-testid="day-cell-background"]').should('have.css', 'background').and('include', 'gradient'); // Optional check
    });
});
