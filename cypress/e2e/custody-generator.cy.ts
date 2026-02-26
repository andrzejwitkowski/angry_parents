describe('Custody Generator E2E', () => {
    Cypress.on('window:console', (msg) => {
        // We can just log to original node console or cy.log
        console.log('CONSOLE:', msg);
    });
    Cypress.on('uncaught:exception', (err, runnable) => {
        console.error('UNCAUGHT EXCEPTION:', err.message);
        return false;
    });

    beforeEach(() => {
        // Clear database to prevent conflict leakage from other test runs
        cy.request({
            method: 'DELETE',
            url: 'http://localhost:3000/api/test/database',
            failOnStatusCode: false // If dev routes aren't active, don't fail immediately
        });

        cy.viewport(1280, 720);
        cy.request('POST', 'http://localhost:3000/api/auth/mock-login'); cy.visit('/dashboard');
        // --- INJECTED: CREATE CHILD BEFORE TESTS ---
        cy.contains('Manage Children').click();
        cy.get('input#name').type('Test Child');
        cy.contains('button', 'Add Child').click();
        cy.contains('Test Child').should('exist');
        cy.get('body').type('{esc}');
        // -----------------------------------------

    });

    it('can open the Custody Wizard and generate an "Every Other Tuesday" schedule', () => {
        // 1. Open Wizard
        cy.contains('button', 'Input Court Schedule').click({ force: true });
        cy.get('[role="dialog"]').should('be.visible');

        // 2. Configure "Custom Loop"
        cy.get('[role="dialog"]').contains('Custom Loop').click();

        // Verify input appears (and has correct preset)
        cy.get('[role="dialog"]').contains('Days On / Off').should('be.visible');
        cy.get('input[placeholder="e.g. 1, 13"]').should('have.value', '1, 13');

        // Select Dates
        cy.get('[role="dialog"]').contains('Start Date').parent().find('input').clear().type('2026-03-03').should('have.value', '2026-03-03');
        cy.get('[role="dialog"]').contains('End Date').parent().find('input').clear().type('2026-03-31').should('have.value', '2026-03-31');

        // Explicitly set Starting Parent to DAD to be sure
        cy.get('[role="dialog"]').contains('Starting Parent').parent().find('button').click();
        cy.get('[role="option"]').contains('Dad').click();

        // 3. Generate
        cy.get('[role="dialog"]').contains('button', 'Generate Schedule').click({ force: true });

        // 4. Verify Preview Results
        // Wait for results
        cy.get('[role="dialog"]').contains('Detected Blocks').should('be.visible');

        // Check the summary totals
        // For a 29-day period (March 3 to March 31):
        // Sequence [1, 13] means 1 day DAD, 13 days MOM, repeat.
        // DAD gets Mar 3, Mar 17, Mar 31 = 3 days
        // MOM gets Mar 4-16 (13 days) and Mar 18-30 (13 days) = 26 days
        cy.get('[role="dialog"]').find('.bg-pink-50 .text-xl.font-bold').should('have.text', '27');
        cy.get('[role="dialog"]').find('.bg-indigo-50 .text-xl.font-bold').should('have.text', '2');
    });
});
