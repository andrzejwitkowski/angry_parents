describe('Authentication Flow', () => {
    it('should register a new user and logout successfully', () => {
        const uniqueId = Date.now();
        const testUser = {
            email: `test_${uniqueId}@example.com`,
            name: 'Cypress Tester',
            username: `cytester_${uniqueId}`
        };

        cy.visit('/auth');
        cy.contains('button', 'Register').click();

        const regTab = '[role="tabpanel"][data-state="active"]';

        cy.get(`${regTab} input[id="reg-name"]`).type(testUser.name);
        cy.get(`${regTab} input[id="reg-username"]`).type(testUser.username);
        cy.get(`${regTab} input[id="reg-email"]`).type(testUser.email);
        cy.get(`${regTab} input[name="gender"][value="dad"]`).check({ force: true });

        cy.get(`${regTab} button.border-dashed`).click();

        // Now should be on dashboard
        cy.url({ timeout: 15000 }).should('include', '/dashboard');
        // i18n agnostic check for dashboard header/element
        cy.get('header').should('be.visible');

        // Logout
        cy.contains(/Logout|Wyloguj/i).click({ force: true });
        // After logout app may redirect to '/' or '/auth'
        cy.url().should('match', /\/(auth)?$/);
    });
});
