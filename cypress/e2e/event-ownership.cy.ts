describe('Event Ownership Authorization', () => {
    const today = new Date().toISOString().split('T')[0];

    // Prevent application crashes from failing tests
    Cypress.on('uncaught:exception', (err, runnable) => {
        return false;
    });

    it('shows delete buttons for owner', () => {
        cy.intercept('GET', '**/api/auth/get-session', {
            statusCode: 200,
            body: {
                user: { id: 'user-owner', email: 'owner@example.com', name: 'Owner User' },
                session: { id: 's-owner', userId: 'user-owner', expiresAt: '2099-01-01' }
            }
        }).as('getSessionOwner');

        const mockItem = {
            id: 'note-1',
            type: 'NOTE',
            date: today,
            content: 'Owner Note',
            createdAt: new Date().toISOString(),
            createdBy: 'user-owner'
        };

        cy.intercept('GET', '**/api/timeline/range*', {
            statusCode: 200,
            body: { items: [mockItem] }
        }).as('getRangeOwner');

        cy.intercept('GET', '**/api/calendar/*/timeline', {
            statusCode: 200,
            body: { items: [mockItem] }
        }).as('getTimelineOwner');

        cy.visit('/dashboard');
        cy.wait(['@getSessionOwner', '@getRangeOwner']);

        cy.log('Dashboard loaded, clicking today cell');
        cy.get('.bg-indigo-600').parents('.group').first().click({ force: true });

        cy.wait('@getTimelineOwner');
        cy.get('.animate-spin', { timeout: 10000 }).should('not.exist');
        cy.contains('Owner Note', { timeout: 10000 }).should('be.visible');

        // SHOULD see delete button (trash icon)
        cy.get('svg.lucide-trash-2').should('exist');
    });

    it('hides delete buttons for non-owner', () => {
        cy.intercept('GET', '**/api/auth/get-session', {
            statusCode: 200,
            body: {
                user: { id: 'user-other', email: 'other@example.com', name: 'Other User' },
                session: { id: 's-other', userId: 'user-other', expiresAt: '2099-01-01' }
            }
        }).as('getSessionOther');

        const mockItem = {
            id: 'note-1',
            type: 'NOTE',
            date: today,
            content: 'Owner Note',
            createdAt: new Date().toISOString(),
            createdBy: 'user-owner'
        };

        cy.intercept('GET', '**/api/timeline/range*', {
            statusCode: 200,
            body: { items: [mockItem] }
        }).as('getRangeOther');

        cy.intercept('GET', '**/api/calendar/*/timeline', {
            statusCode: 200,
            body: { items: [mockItem] }
        }).as('getTimelineOther');

        cy.visit('/dashboard');
        cy.wait(['@getSessionOther', '@getRangeOther']);

        cy.log('Dashboard loaded as other, clicking today cell');
        cy.get('.bg-indigo-600').parents('.group').first().click({ force: true });

        cy.wait('@getTimelineOther');
        cy.get('.animate-spin', { timeout: 10000 }).should('not.exist');
        cy.contains('Owner Note', { timeout: 10000 }).should('be.visible');

        // SHOULD NOT see delete button (trash icon)
        cy.get('svg.lucide-trash-2').should('not.exist');
    });

    it('disables medication checkbox for non-owners', () => {
        cy.intercept('GET', '**/api/auth/get-session', {
            statusCode: 200,
            body: {
                user: { id: 'user-other', email: 'other@example.com', name: 'Other User' },
                session: { id: 's-other', userId: 'user-other', expiresAt: '2099-01-01' }
            }
        }).as('getSessionMeds');

        const mockMeds = {
            id: 'meds-1',
            type: 'MEDS',
            date: today,
            medicineName: 'Aspirin',
            dosage: '100mg',
            administered: false,
            createdAt: new Date().toISOString(),
            createdBy: 'user-owner'
        };

        cy.intercept('GET', '**/api/timeline/range*', {
            statusCode: 200,
            body: { items: [mockMeds] }
        }).as('getRangeMeds');

        cy.intercept('GET', '**/api/calendar/*/timeline', {
            statusCode: 200,
            body: { items: [mockMeds] }
        }).as('getTimelineMeds');

        cy.visit('/dashboard');
        cy.wait(['@getSessionMeds', '@getRangeMeds']);

        cy.log('Dashboard loaded for meds check, clicking today cell');
        cy.get('.bg-indigo-600').parents('.group').first().click({ force: true });

        cy.wait('@getTimelineMeds');
        cy.get('.animate-spin', { timeout: 10000 }).should('not.exist');
        cy.contains('Aspirin', { timeout: 10000 }).should('be.visible');

        // Checkbox should be disabled
        cy.get('button[role="checkbox"]').should('be.disabled');
    });
});
