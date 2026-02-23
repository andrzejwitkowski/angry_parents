/// <reference types="cypress" />

describe('Rule Engine - Visual Induction Proof (N+1)', () => {
    // Colors from DayCellBackground.tsx
    // Cypress might normalize decimals, so be careful.
    // MOM: rgba(236, 72, 153, 0.15)
    // DAD: rgba(79, 70, 229, 0.15)

    // We can just check "contain" the base RGB values if exact alpha is tricky/variable
    // Mom Base: 236, 72, 153
    // Dad Base: 79, 70, 229

    beforeEach(() => {
        // Register New User (Fresh DB)
        cy.visit('/auth');
        cy.contains('Register').click(); // Switch Tab
        cy.get('input#reg-name').type('Test User');
        cy.get('input#reg-username').type('testuser' + Date.now());
        cy.get('input#reg-email').type(`test${Date.now()}@example.com`);
        cy.get('input#reg-password').type('password123');
        cy.get('button[type="submit"]').click();

        // Debug: Check for error message
        cy.get('body').then($body => {
            if ($body.find('.text-destructive').length > 0) {
                cy.log('Registration Error:', $body.find('.text-destructive').text());
            }
        });

        // Wait for dashboard with longer timeout
        cy.location('pathname', { timeout: 10000 }).should('eq', '/setup-passkey');
        cy.contains('Dev: Simulate Key').click();
        cy.location('pathname', { timeout: 10000 }).should('eq', '/dashboard');
        // --- INJECTED: CREATE CHILD BEFORE TESTS ---
        cy.contains('Manage Children').click();
        cy.get('input#name').type('Test Child');
        cy.contains('button', 'Add Child').click();
        cy.contains('Test Child').should('exist');
        cy.get('body').type('{esc}');
        // -----------------------------------------


        // Wait for calendar/sidebar loaded
        cy.contains('Input Court Schedule', { timeout: 10000 }).should('be.visible');
    });



    it('Visually proves the Tower of Overrides (Blue -> Pink -> Blue -> Pink -> Revert)', () => {
        // Step 0: Ensure we are on the dashboard
        const openWizard = () => cy.contains('button', 'Input Court Schedule').click();
        const saveRule = () => cy.contains('Confirm & Save').scrollIntoView().click({ force: true });

        const createRule = (parent: 'MOM' | 'DAD', startDate: string, endDate: string) => {
            openWizard();
            // Wait for modal
            cy.contains('Custody Scheduler').should('be.visible');

            // Fill Form
            cy.contains('Alt. Weekend').click(); // Select type first
            cy.get('input[type="date"]').first().clear().type(startDate);
            cy.get('input[type="date"]').last().clear().type(endDate);

            // Select Parent
            cy.get('[data-testid="starting-parent-select"]').click();
            cy.get('[role="option"]').contains(parent === 'MOM' ? 'Mom' : 'Dad').click();

            // Intercept conflict check
            cy.intercept('POST', '**/api/rules/check-conflicts').as('checkConflicts');

            // Click Generate
            cy.contains('Generate Schedule').click();

            cy.wait('@checkConflicts').then((interception) => {
                const conflicts = interception.response?.body?.conflicts;
                if (conflicts && conflicts.length > 0) {
                    // Click proceed anyway
                    cy.contains('Proceed Anyway').click({ force: true });
                }
            });

            // Wait for preview entries to appear
            cy.contains('Confirm & Save').scrollIntoView().should('be.visible');

            // Save
            saveRule();
            // Wait for Close
            cy.contains('Custody Scheduler').should('not.exist');
            // Wait for Refresh (toast or grid update)
            cy.wait(1000); // Give backend time to process and SSE/fetch to update
        };

        // --- NAVIGATION: Go to May 2026 ---
        const navigateToMay2026 = () => {
            cy.get('h2').invoke('text').then((text) => {
                if (!text.includes('May 2026')) {
                    cy.get('button[aria-label="Next Month"]').click();
                    cy.wait(200);
                    navigateToMay2026();
                }
            });
        };
        navigateToMay2026();

        // --- BASE CASE (N=0) ---
        // Create Rule 1: DAD (Blue) for May 15.
        // Alt Weekend starting May 1st DAD. May 15 should be DAD.
        createRule('DAD', '2026-05-01', '2026-05-30');

        // Assert Visual: May 16 is Blue
        // Find element with text "16".
        cy.contains('.text-lg', '16').parents('div.relative.text-left').as('day16');

        cy.get('@day16')
            .find('[data-testid="day-cell-background"] > div > div.absolute.inset-0')
            .should('have.css', 'background-color').and('contain', '79, 70, 229'); // Indigo/Blue

        // --- INDUCTIVE STEP (N+1) ---
        // Create Rule 2: MOM (Pink) for May 16.
        createRule('MOM', '2026-05-16', '2026-05-17');

        // Assert: May 16 turns Pink
        cy.get('@day16')
            .find('[data-testid="day-cell-background"] > div > div.absolute.inset-0')
            .should('have.css', 'background-color').and('contain', '236, 72, 153'); // Pink

        // --- INDUCTIVE STEP (N+2) ---
        // Create Rule 3: DAD (Blue) for May 16.
        createRule('DAD', '2026-05-16', '2026-05-16'); // Just one day

        // Assert: May 16 turns Blue
        cy.get('@day16')
            .find('[data-testid="day-cell-background"] > div > div.absolute.inset-0')
            .should('have.css', 'background-color').and('contain', '79, 70, 229'); // Back to Blue

        // --- DELETE STEP (Revert) ---
        // Delete Rule 3. Should revert to Rule 2 (Pink).
        openWizard();

        // Find row using data-testid
        cy.contains('[data-testid="rule-item"]', '2026-05-16 - 2026-05-16')
            .find('[data-testid="delete-rule-btn"]')
            .click();

        // Confirmation Dialog
        cy.contains('Delete Schedule Pattern?').should('be.visible');
        cy.contains('Delete and Clear Calendar').click();

        // Wait for Refresh
        cy.contains('Custody Scheduler', { timeout: 10000 }).should('not.exist');
        cy.wait(1000);

        // Assert: May 16 turns Pink again
        cy.get('@day16')
            .find('[data-testid="day-cell-background"] > div > div.absolute.inset-0')
            .should('have.css', 'background-color').and('contain', '236, 72, 153'); // Pink again!
    });
});
