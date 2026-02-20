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

        cy.get('button[type="submit"]').contains('Sign Up').click();

        // Should be redirected to setup passkey first
        cy.url().should('include', '/setup-passkey');
        cy.contains('Secure Your Account');

        // Simulate Passkey
        cy.intercept('POST', '**/api/auth/webauthn/register/verify').as('verify');
        cy.contains('Dev: Simulate Key').click();
        cy.wait('@verify');

        // Now should be on dashboard
        cy.url({ timeout: 15000 }).should('include', '/dashboard');
        cy.contains('Dashboard').should('be.visible');
        cy.contains(`@${testUser.username}`).should('be.visible');

        // Logout
        cy.contains('Logout').click({ force: true });
        cy.url().should('eq', Cypress.config().baseUrl + '/auth');
    });
});
