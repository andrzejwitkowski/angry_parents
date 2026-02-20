describe('Settings Page - Language Preferences', () => {
    it('should change language and persist it to localStorage', () => {
        cy.visit('/settings');

        // Verify default english texts
        cy.contains('Settings').should('be.visible');
        cy.contains('Language Preference').should('be.visible');

        // Click the select dropdown
        cy.get('button[role="combobox"]').click();

        // Select 'Polski'
        cy.get('div[role="option"]').contains('Polski').click();

        // Verify strings updated to Polish immediately
        cy.contains('Ustawienia').should('be.visible');
        cy.contains('Preferencje Językowe').should('be.visible');

        // Verify it was saved to localStorage
        cy.window().then((win) => {
            expect(win.localStorage.getItem('i18nextLng')).to.eq('pl');
        });

        // Verify persistence on reload
        cy.reload();
        cy.contains('Ustawienia').should('be.visible');
    });
});
