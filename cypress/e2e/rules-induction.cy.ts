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
        cy.location('pathname', { timeout: 10000 }).should('eq', '/dashboard');

        // Wait for calendar/sidebar loaded
        cy.contains('Generate Schedule', { timeout: 10000 }).should('be.visible');
    });

    const TARGET_DATE = '2030-01-15'; // Far future to ensure no conflicts

    it('Visually proves the Tower of Overrides (Blue -> Pink -> Blue -> Pink -> Revert)', () => {
        // Step 0: Ensure we are on the dashboard
        const openWizard = () => cy.contains('button', 'Generate Schedule').click();
        const saveRule = () => cy.contains('Confirm & Save').click();

        const createRule = (parent: 'MOM' | 'DAD', startDate: string, endDate: string) => {
            openWizard();
            // Wait for modal
            cy.contains('Custody Scheduler').should('be.visible');

            // Fill Form
            cy.contains('Alt. Weekend').click(); // Select type first
            cy.get('input[type="date"]').first().clear().type(startDate);
            cy.get('input[type="date"]').last().clear().type(endDate);

            // Select Parent
            cy.contains('Select parent').parent().click();
            cy.contains(parent === 'MOM' ? 'Mom' : 'Dad').click();

            // Click Generate
            cy.contains('Generate Schedule').click();
            // Wait for preview
            cy.contains(`Generated`).should('be.visible');

            // Save
            saveRule();
            // Wait for Close
            cy.contains('Custody Scheduler').should('not.exist');
            // Wait for Refresh (toast or grid update)
            cy.wait(1000); // Give backend time to process and SSE/fetch to update
        };

        // --- BASE CASE (N=0) ---
        // Create Rule 1: DAD (Blue) for May 15.
        // Alt Weekend starting May 1st DAD. May 15 should be DAD.
        createRule('DAD', '2026-05-01', '2026-05-30');

        // Assert Visual: May 15 is Blue
        // Find element with text "15".
        cy.contains('.text-lg', '15').parents('div.relative.text-left').as('day15');

        cy.get('@day15')
            .find('[data-testid="day-cell-background"]')
            .should('have.css', 'background-color').and('contain', '79, 70, 229'); // Indigo/Blue

        // --- INDUCTIVE STEP (N+1) ---
        // Create Rule 2: MOM (Pink) for May 15.
        createRule('MOM', '2026-05-15', '2026-05-16');

        // Assert: May 15 turns Pink
        cy.get('@day15')
            .find('[data-testid="day-cell-background"]')
            .should('have.css', 'background-color').and('contain', '236, 72, 153'); // Pink

        // --- INDUCTIVE STEP (N+2) ---
        // Create Rule 3: DAD (Blue) for May 15.
        createRule('DAD', '2026-05-15', '2026-05-15'); // Just one day

        // Assert: May 15 turns Blue
        cy.get('@day15')
            .find('[data-testid="day-cell-background"]')
            .should('have.css', 'background-color').and('contain', '79, 70, 229'); // Back to Blue

        // --- DELETE STEP (Revert) ---
        // Delete Rule 3. Should revert to Rule 2 (Pink).
        // Find row using data-testid
        cy.contains('[data-testid="rule-item"]', '2026-05-15')
            .contains('span', 'Starts')
            .parents('[data-testid="rule-item"]')
            .find('[data-testid="delete-rule-btn"]')
            .click();

        // Confirmation Dialog
        cy.contains('Delete Pattern?').should('be.visible');
        cy.contains('Delete').click();

        // Close Wizard
        cy.get('body').click(0, 0); // Close or click X

        // Assert: May 15 reverts to Pink
        cy.get('@day15')
            .find('[data-testid="day-cell-background"]')
            .should('have.css', 'background-color').and('contain', '236, 72, 153'); // Pink again!
    });
});
