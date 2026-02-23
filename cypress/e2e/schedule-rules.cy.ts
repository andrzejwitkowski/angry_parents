/// <reference types="cypress" />

describe('Schedule Rule Management', () => {
    beforeEach(() => {
        // Clear database
        cy.request({
            method: 'DELETE',
            url: 'http://localhost:3000/api/test/database',
            failOnStatusCode: false
        });

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

        // Wait for redirect to dashboard
        cy.url({ timeout: 15000 }).should('include', '/setup-passkey');
        cy.contains('Dev: Simulate Key').click();
        cy.url({ timeout: 15000 }).should('include', '/dashboard');

        // Create a child
        cy.contains('Manage Children').click();
        cy.get('input#name').type('Rule Child');
        cy.contains('button', 'Add Child').click();
        cy.contains('Rule Child').should('exist');
        cy.get('body').type('{esc}');
        cy.wait(500);
    });

    it('Scenario: Oops Workflow (Create and Delete Rule)', () => {
        // 1. Open Wizard
        cy.contains('button', 'Input Court Schedule').click({ force: true });
        cy.get('[role="dialog"]').should('be.visible');

        // 2. Configure a Rule
        const start = '2025-01-01'; // Future date
        const end = '2025-01-14';

        cy.get('[role="dialog"]').contains('Start Date').parent().find('input').clear().type(start);
        cy.get('[role="dialog"]').contains('End Date').parent().find('input').clear().type(end);
        cy.get('[role="dialog"]').contains('button', 'Generate Schedule').click({ force: true });

        // 3. Save (Confirm & Save)
        cy.contains('button', 'Confirm & Save').scrollIntoView().click({ force: true });

        // Wait for dialog and overlay to close/animate out
        cy.get('[role="dialog"]').should('not.exist');
        cy.wait(500);

        // 4. Re-open Wizard to Verify & Delete
        cy.contains('button', 'Input Court Schedule').click({ force: true });
        cy.get('[role="dialog"]').should('be.visible');
        cy.wait(1000); // Wait for animation

        // 5. Verify Rule Appears in List
        cy.contains('Active Patterns').scrollIntoView().should('be.visible');
        cy.contains('Alt. Weekend').scrollIntoView().should('be.visible');
        cy.contains('2025-01-01 - 2025-01-14').scrollIntoView().should('be.visible');

        // Let's Delete it.
        cy.get('button').find('svg.lucide-trash-2').scrollIntoView().click({ force: true });

        // 6. Confirm Delete
        cy.get('[role="alertdialog"]').should('be.visible');
        cy.contains('Delete and Clear Calendar').click();

        // 7. Verify Rule is Gone
        cy.contains('2025-01-01 - 2025-01-14').should('not.exist');
        cy.contains('No active schedule patterns found').scrollIntoView().should('be.visible');
    });
});
