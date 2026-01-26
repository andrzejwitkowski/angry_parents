describe('Dashboard Flow', () => {
    beforeEach(() => {
        cy.visit('/auth');
        cy.contains('button', 'Register').click();
        const id = Date.now();
        cy.get('#reg-name').type('Dashboard Tester');
        cy.get('#reg-username').type(`dbtester_${id}`);
        cy.get('#reg-email').type(`db_${id}@example.com`);
        cy.get('#reg-password').type('Password123!');
        cy.get('button[type="submit"]').contains('Submit').click();
        cy.url().should('include', '/dashboard');
    });

    it('should toggle the sidebar', () => {
        cy.contains('Calendar').should('be.visible');
        // Toggle button is the first button in sidebar header (round arrow button)
        cy.get('main').prev('div').find('button').first().click({ force: true });
    });

    it('should navigate between months in the calendar', () => {
        cy.contains('January 2026').should('be.visible');

        // Click Next Month using aria-label
        cy.get('button[aria-label="Next Month"]').click();
        cy.contains('February 2026').should('be.visible');

        // Click Previous Month using aria-label
        cy.get('button[aria-label="Previous Month"]').click();
        cy.contains('January 2026').should('be.visible');
    });

    it('should open custom month popover', () => {
        cy.contains('Custom Month').click();
        cy.get('[role="dialog"]').should('be.visible');
    });
});
