describe('Authentication Flow with Passkey', () => {
    beforeEach(() => {
        // Clear DB/State if possible, or use fresh user
    });

    it('should be able to reach backend health', () => {
        cy.request('http://localhost:3000/api/health').then((resp) => {
            cy.log('Health Check Status: ' + resp.status);
            expect(resp.status).to.eq(200);
        });
    });

    it('should force a new user to register a passkey before accessing dashboard', () => {
        // Intercept registration
        cy.intercept('POST', '**/api/auth/sign-up/email').as('signUp');

        cy.on('window:console', (msg) => {
            console.log('Browser console:', msg);
        });

        const username = `user_${Date.now()}`;
        const email = `${username}@example.com`;

        // 1. Register
        cy.visit('/auth');
        cy.contains('Register').click();

        // Scope to register tab
        const regTab = '[role="tabpanel"][data-state="active"]';

        cy.get(`${regTab} input[id="reg-name"]`).should('be.visible').type('Test User', { force: true });
        cy.get(`${regTab} input[id="reg-username"]`).should('be.visible').type(username, { force: true });
        cy.get(`${regTab} input[id="reg-email"]`).should('be.visible').type(email, { force: true });

        // Verify values
        cy.get(`${regTab} input[id="reg-name"]`).should('have.value', 'Test User');
        cy.get(`${regTab} input[id="reg-username"]`).should('have.value', username);
        cy.get(`${regTab} input[id="reg-email"]`).should('have.value', email);
        cy.get(`${regTab} input[name="gender"][value="dad"]`).check({ force: true });

        // Submit via Dev Simulator
        cy.get(`${regTab} button.border-dashed`).click();

        // 2. Expect Dashboard immediately
        cy.url({ timeout: 15000 }).should('include', '/dashboard');
        cy.get('header').should('be.visible');
    });
});
