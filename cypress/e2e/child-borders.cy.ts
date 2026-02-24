/// <reference types="cypress" />

describe('Multi-Child Border Colors', () => {
    beforeEach(() => {
        // Ignore ResizeObserver loop limit exceeded error
        Cypress.on('uncaught:exception', (err) => {
            if (err.message.includes('ResizeObserver loop completed with undelivered notifications')) {
                return false;
            }
        });

        // Clear database
        cy.request({
            method: 'DELETE',
            url: 'http://localhost:3000/api/test/database',
            failOnStatusCode: false
        });

        cy.viewport(1280, 720);
        // Login flow
        cy.visit('/auth');
        cy.contains('Register').click();
        const suffix = Date.now();
        cy.get('input[placeholder="John Doe"]').type(`Border User ${suffix}`);
        cy.get('input[placeholder="johndoe"]').type(`borderuser${suffix}`);
        cy.get('input[placeholder="name@example.com"]').type(`borderuser${suffix}@test.com`);
        cy.get('input[type="password"]').first().type('password123');
        cy.get('button[type="submit"]').click();

        // Wait for redirect to dashboard
        cy.url({ timeout: 15000 }).should('include', '/setup-passkey');
        cy.contains('Dev: Simulate Key').click();
        cy.url({ timeout: 15000 }).should('include', '/dashboard');

        // Create Child 1 (Siuska - Pink)
        cy.contains('Manage Children').click();
        cy.get('input#name').type('Siuska');
        // Child color is pink by default or we can try to select? 
        // Let's just assume the default colors are different for first two.
        cy.contains('button', 'Add Child').click();
        cy.contains('Siuska').should('exist');

        // Create Child 2 (Bobby - Blue)
        cy.get('input#name').clear().type('Bobby');
        // Let's try to change color if possible, or just trust the system sets different colors.
        cy.contains('button', 'Add Child').click();
        cy.contains('Bobby').should('exist');

        cy.get('body').type('{esc}');
        cy.wait(500);
    });

    it('should show border colors for multiple children', () => {
        // 1. Set schedule for Siuska
        cy.contains('button', 'Input Court Schedule').click({ force: true });
        cy.get('[role="dialog"]').last().should('be.visible');

        // Select Siuska
        cy.get('[role="dialog"]').last().within(() => {
            cy.get('button[role="combobox"]').first().click();
        });
        cy.contains('[role="option"]', 'Siuska').click();

        cy.get('[role="dialog"]').last().contains('Alt. Weekend').click();
        cy.get('[role="dialog"]').last().contains('Start Date').parent().find('input').clear().type('2026-02-01');
        cy.get('[role="dialog"]').last().contains('End Date').parent().find('input').clear().type('2026-02-28');
        cy.get('[role="dialog"]').last().contains('button', 'Generate Schedule').click({ force: true });
        cy.wait(500);

        // Confirm Siuska's schedule in the preview modal
        cy.get('[role="dialog"]').last().contains('button', 'Confirm & Save').click({ force: true });
        cy.wait(500);

        // 2. Set schedule for Bobby
        cy.contains('button', 'Input Court Schedule').click({ force: true });
        cy.get('[role="dialog"]').last().within(() => {
            cy.get('button[role="combobox"]').first().click();
        });
        cy.contains('[role="option"]', 'Bobby').click();

        cy.get('[role="dialog"]').last().contains('Alt. Weekend').click();
        cy.get('[role="dialog"]').last().contains('Start Date').parent().find('input').clear().type('2026-02-01');
        cy.get('[role="dialog"]').last().contains('End Date').parent().find('input').clear().type('2026-02-28');
        cy.get('[role="dialog"]').last().contains('button', 'Generate Schedule').click({ force: true });
        cy.wait(500);

        // Confirm Bobby's schedule
        cy.get('[role="dialog"]').last().contains('button', 'Confirm & Save').click({ force: true });
        cy.wait(500);

        // 3. Navigate to Feb 2026
        const navigateToFeb2026 = () => {
            cy.get('h2').invoke('text').then((text) => {
                if (!text.includes('February 2026')) {
                    cy.get('button[aria-label="Next Month"]').click();
                    cy.wait(200);
                    navigateToFeb2026();
                }
            });
        };
        navigateToFeb2026();

        // Verify split blocks with borders
        // Check a random day in Feb (e.g. Feb 3rd)
        // Ensure we pick only one '3' (the one from current month, not previous/next)
        // The current month days don't have grayscale-[0.5] or opacity-40
        cy.get('.group').not('.opacity-40').contains('span', /^3$/).closest('.group').first().within(() => {
            // Should have two child blocks
            cy.get('[data-testid="day-cell-background"]').first().within(() => {
                // There should be two children of the data-testid="day-cell-background" 
                // Each is a SingleChildBackground container
                cy.get('> div.absolute').should('have.length', 2);

                // Get the colors of the children and ensure they have borders
                cy.get('> div.absolute').first().should('have.css', 'border-width', '2px');
                cy.get('> div.absolute').first().should('not.have.css', 'border-color', 'rgba(0, 0, 0, 0)');

                cy.get('> div.absolute').last().should('have.css', 'border-width', '2px');
                cy.get('> div.absolute').last().should('not.have.css', 'border-color', 'rgba(0, 0, 0, 0)');
            });
        });
    });
});
