describe('i18n Localization', () => {
    it('should display the english translations on the login page by default', () => {
        cy.visit('/auth');

        // Verify login/auth translated strings
        cy.contains('Login').should('be.visible');
        cy.contains('Email').should('be.visible');
        cy.contains('Password').should('be.visible');

        // Check register tab
        cy.contains('button[role="tab"]', 'Register').click();
        cy.contains('Username').should('be.visible');
    });
});
