describe('Authentication Flow', () => {
    it('should register a new user and logout successfully', () => {
        const uniqueId = Date.now();
        const testUser = {
            email: `test_${uniqueId}@example.com`,
            password: 'Password123!',
            name: 'Cypress Tester',
            username: `cytester_${uniqueId}`
        };

        cy.visit('/auth');
        cy.contains('button', 'Register').click();

        cy.get('#reg-name').type(testUser.name);
        cy.get('#reg-username').type(testUser.username);
        cy.get('#reg-email').type(testUser.email);
        cy.get('#reg-password').type(testUser.password);

        cy.get('button[type="submit"]').contains('Submit').click();

        // Should be redirected to dashboard
        cy.url().should('include', '/dashboard');
        cy.contains('Co-Parenting Hub').should('be.visible');
        cy.contains(`@${testUser.username}`).should('be.visible');

        // Logout
        cy.contains('Logout').click({ force: true });
        cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
});
