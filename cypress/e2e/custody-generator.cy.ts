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
        cy.visit('/auth');
        cy.contains('Register').click();

        const suffix = Date.now();
        cy.get('input[placeholder="John Doe"]').type(`Test User ${suffix}`);
        cy.get('input[placeholder="johndoe"]').type(`user${suffix}`);
        cy.get('input[placeholder="name@example.com"]').type(`user${suffix}@test.com`);
        cy.get('input[type="password"]').first().type('password123');
        cy.get('button[type="submit"]').click();
        cy.url({ timeout: 15000 }).should('include', '/setup-passkey');
        cy.contains('Dev: Simulate Key').click();
        cy.url({ timeout: 15000 }).should('include', '/dashboard');
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
        cy.get('[role="dialog"]').contains('2026-03-03').scrollIntoView().should('be.visible');

        // Day 1: Mar 3. Diff=0. Block 0. DAD.
        cy.get('[role="dialog"]').contains('2026-03-03').scrollIntoView().closest('.border-slate-100').within(() => {
            cy.contains('DAD');
        });

        // Check Day 3 (Mar 5). Diff=2. Block 1 (covers days 1-13). MOM.
        cy.get('[role="dialog"]').contains('2026-03-05').scrollIntoView().closest('.border-slate-100').within(() => {
            cy.contains('MOM');
        });

        // Check 2 weeks later: Mar 17 (Tue) -> DAD (Cycle repeats). Diff=14. Block 0. DAD.
        cy.get('[role="dialog"]').contains('2026-03-17').scrollIntoView().closest('.border-slate-100').within(() => {
            cy.contains('DAD');
        });
    });
});
