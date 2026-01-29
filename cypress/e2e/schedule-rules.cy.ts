/// <reference types="cypress" />

describe('Schedule Rule Management', () => {
    beforeEach(() => {
        cy.viewport(1280, 800);
        cy.visit('/auth');
        // Quick login/register
        const suffix = Date.now();
        cy.contains('Register').click();
        cy.get('input[placeholder="John Doe"]').type(`Rule User ${suffix}`);
        cy.get('input[placeholder="johndoe"]').type(`ruleuser${suffix}`);
        cy.get('input[placeholder="name@example.com"]').type(`ruleuser${suffix}@test.com`);
        cy.get('input[type="password"]').first().type('password123');
        cy.get('button[type="submit"]').click();
        cy.wait(500);
    });

    it('Scenario: Oops Workflow (Create and Delete Rule)', () => {
        // 1. Open Wizard
        cy.contains('button', 'Generate Schedule').click({ force: true });
        cy.get('[role="dialog"]').should('be.visible');

        // 2. Configure a Rule
        const start = '2025-01-01'; // Future date
        const end = '2025-01-14';

        cy.get('[role="dialog"]').contains('Start Date').parent().find('input').type(start);
        cy.get('[role="dialog"]').contains('End Date').parent().find('input').type(end);
        cy.get('[role="dialog"]').contains('button', 'Generate Schedule').click({ force: true });

        // 3. Save (Confirm & Save)
        cy.contains('button', 'Confirm & Save').should('be.visible').click();

        // 4. Verify Rule Appears in List
        cy.contains('Active Patterns').should('be.visible');
        cy.contains('Alt. Weekend').should('be.visible');
        cy.contains('2025-01-01 - 2025-01-14').should('be.visible');

        // 5. Verify Calendar Entries (Implicit via onSave which refreshes calendar)
        // Close dialog to check calendar? 
        // We modified onSave to passing refresh callback. But the Dialog is still open?
        // Actually CustodyWizard is inside a Dialog in Dashboard.tsx. 
        // If we want to check calendar we should close it. 
        // But the task is to verify "Delete Rule" cleans up.
        // We can check the list of rules.

        // Let's Delete it.
        cy.get('button').find('svg.lucide-trash-2').click();

        // 6. Confirm Delete
        cy.get('[role="alertdialog"]').should('be.visible');
        cy.contains('Delete and Clear Calendar').click();

        // 7. Verify Rule is Gone
        cy.contains('2025-01-01 - 2025-01-14').should('not.exist');
        cy.contains('No active schedule patterns found').should('be.visible');
    });
});
