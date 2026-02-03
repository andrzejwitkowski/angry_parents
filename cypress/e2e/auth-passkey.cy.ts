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
        cy.get(`${regTab} input[id="reg-password"]`).should('be.visible').type('password123', { force: true });

        // Verify values
        cy.get(`${regTab} input[id="reg-name"]`).should('have.value', 'Test User');
        cy.get(`${regTab} input[id="reg-username"]`).should('have.value', username);
        cy.get(`${regTab} input[id="reg-email"]`).should('have.value', email);

        // Submit via form
        cy.log('Submitting registration form via form submit...');
        cy.get(`${regTab} form`).should('exist').submit();

        // 2. Expect Redirect to Setup
        cy.url({ timeout: 15000 }).should('include', '/setup-passkey');
        cy.contains('Secure Your Account');

        // Cleanup DOM markers if any? Not needed as we navigate away.

        // 3. Try to skip (Manually go to dashboard)
        cy.visit('/dashboard');
        // Should be redirected back
        cy.url().should('include', '/setup-passkey');

        // 4. Use Dev Mock
        cy.intercept('POST', '**/api/auth/webauthn/register/verify').as('verify');

        cy.contains('Dev: Simulate Key').click();

        cy.wait('@verify').then((interception) => {
            cy.log('Verify Request Body: ' + JSON.stringify(interception.request.body));
            cy.log('Verify Response Body: ' + JSON.stringify(interception.response?.body));
            if (interception.response?.statusCode !== 200) {
                throw new Error(`Verify call failed with status ${interception.response?.statusCode}: ${JSON.stringify(interception.response?.body)}`);
            }
        });

        // 5. Expect Dashboard
        cy.url({ timeout: 15000 }).should('include', '/dashboard');
        cy.contains('Co-Parenting Hub');
    });
});
