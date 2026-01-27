describe('Day Details Logbook Flow', () => {
    beforeEach(() => {
        // Mock the session request from better-auth
        cy.intercept('GET', '**/api/auth/get-session', {
            statusCode: 200,
            body: {
                user: {
                    id: 'user-123',
                    email: 'test@example.com',
                    name: 'Test User'
                },
                session: {
                    id: 'session-123',
                    userId: 'user-123',
                    expiresAt: new Date(Date.now() + 3600000).toISOString()
                }
            }
        }).as('getSession');

        cy.visit('/dashboard');
        cy.wait('@getSession');
        cy.contains('Dashboard').should('be.visible');
    });

    it('allows user to open day details and add a medical visit', () => {
        // Click on today
        cy.contains(new Date().getDate().toString()).first().click();

        // Verify sheet opened
        cy.contains('Day Logbook').should('be.visible');

        // Select medical mode
        cy.get('[data-testid="action-medical_visit"]').click();

        // Fill form
        cy.get('input[name="doctor"]').type('Dr. Gregory House');
        cy.get('input[name="diagnosis"]').type('Lupus (Probable)');
        cy.get('textarea[name="recommendations"]').type('Vicodin and sarcastic remarks');

        // Submit
        cy.get('[data-testid="submit-medical"]').click();

        // Verify entry appeared in feed
        cy.contains('Dr. Gregory House').should('be.visible');
        cy.contains('Lupus (Probable)').should('be.visible');
    });

    it('allows user to add and toggle medication', () => {
        cy.contains(new Date().getDate().toString()).first().click();

        cy.get('[data-testid="action-meds"]').click();

        cy.get('input[name="medicineName"]').type('Advil');
        cy.get('input[name="dosage"]').type('200mg');

        cy.get('[data-testid="submit-meds"]').click();

        // Verify entry
        cy.contains('Advil').should('be.visible');

        // Toggle checkbox
        cy.get('button[role="checkbox"]').click();

        // Verify updated state (if UI reflects it)
        cy.get('button[role="checkbox"]').should('have.attr', 'aria-checked', 'true');
    });
});
