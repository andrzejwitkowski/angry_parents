describe('Schedule Propagation', () => {
    beforeEach(() => {
        cy.request('POST', 'http://localhost:3000/api/auth/mock-login'); cy.visit('/dashboard');
        // --- INJECTED: CREATE CHILD BEFORE TESTS ---
        cy.contains('Manage Children').click();
        cy.get('input#name').type('Test Child');
        cy.contains('button', 'Add Child').click();
        cy.contains('Test Child').should('exist');
        cy.get('body').type('{esc}');
        // -----------------------------------------

        cy.contains('Input Court Schedule').should('be.visible');
    });

    it('should create a recurring rule and open propagation modal', () => {
        // 1. Open Wizard
        cy.contains('Input Court Schedule').click();

        // 2. Configure a single recurring rule
        cy.get('input[type="date"]').first().type('2026-01-01');
        cy.get('input[type="date"]').last().type('2026-01-31');
        cy.contains('Alt. Weekend').click();
        // Dad is default, skip selection

        // 3. Generate and save
        cy.get('[data-testid="generate-btn"]').should('be.visible');
        cy.get('[data-testid="generate-btn"]').click({ force: true });

        // Handle possible conflict dialog from leftover data
        cy.wait(2000);
        cy.get('body').then(($body) => {
            if ($body.text().includes('Schedule Conflict Detected')) {
                cy.contains('Proceed Anyway').click();
            }
        });

        // Wait for preview and save
        cy.contains('Generated', { timeout: 15000 }).scrollIntoView().should('exist');
        cy.contains('Confirm & Save').scrollIntoView().click({ force: true });

        // Wait for UI to update
        cy.wait(1000);

        // 4. Reopen wizard to see Active Patterns (wizard may collapse after save)
        cy.contains('Input Court Schedule').click();
        cy.wait(500);

        // 5. Verify Active Patterns shows our rule (may need scroll)
        cy.contains('Active Patterns', { timeout: 10000 }).scrollIntoView().should('exist');
        cy.contains('Alt. Weekend (2026-01-01)').scrollIntoView().should('exist');

        // 5. Click Propagate and verify modal opens
        cy.contains('Propagate to Next Month').scrollIntoView().click({ force: true });

        // 6. Wait for modal with generous timeout
        cy.contains('Propagate Schedule', { timeout: 15000 }).should('exist');

        // 7. Verify modal content
        cy.contains('To Be Created').should('exist');
        cy.get('[data-testid="confirm-propagate-btn"]').should('exist');

        // 8. Click confirm
        cy.get('[data-testid="confirm-propagate-btn"]').click({ force: true });

        // 9. Verify Feb Rule exists after propagation in Active Patterns
        cy.wait(2000);
        // Reopen wizard (modal closes after propagation)
        cy.contains('Input Court Schedule').click();
        cy.wait(500);
        cy.contains('Active Patterns').scrollIntoView();
        cy.contains('Alt. Weekend (2026-02-01)', { timeout: 15000 }).scrollIntoView().should('exist');
    });
});
