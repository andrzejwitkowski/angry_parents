describe('Dashboard Flow', () => {
    beforeEach(() => {
        cy.request('POST', 'http://localhost:3000/api/auth/mock-login'); cy.visit('/dashboard');
    });

    it('should toggle the sidebar', () => {
        cy.contains('Calendar').should('be.visible');
        // Toggle button is the first button in sidebar header (round arrow button)
        cy.get('main').prev('div').find('button').first().click({ force: true });
    });

    it('should navigate between months in the calendar', () => {
        const now = new Date();
        const currentMonthString = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

        now.setMonth(now.getMonth() + 1);
        const nextMonthString = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

        cy.contains(currentMonthString).should('be.visible');

        // Click Next Month using aria-label
        cy.get('button[aria-label="Next Month"]').click();
        cy.contains(nextMonthString).should('be.visible');

        // Click Previous Month using aria-label
        cy.get('button[aria-label="Previous Month"]').click();
        cy.contains(currentMonthString).should('be.visible');
    });

    it('should open custom month popover', () => {
        cy.contains('Custom Month').click();
        cy.get('[role="dialog"]').should('be.visible');
    });

    it('shows "No activity this week" when no upcoming events exist', () => {
        cy.intercept('GET', '**/api/timeline/range**', {
            statusCode: 200,
            body: { items: [] },
        }).as('getRange');

        cy.visit('/dashboard');
        cy.wait('@getRange');

        cy.get('[data-testid="next-up-empty"]').should('be.visible');
        cy.contains('No activity this week').should('be.visible');
    });

    it('shows handover details when a handover event is scheduled this week', () => {
        const today = new Date().toISOString().split('T')[0];

        cy.intercept('GET', '**/api/timeline/range**', {
            statusCode: 200,
            body: {
                items: [{
                    id: 'handover-test-1',
                    type: 'HANDOVER',
                    date: today,
                    time: '23:59',
                    location: 'Central Park South',
                    status: 'PENDING',
                    createdAt: `${today}T00:00:00Z`,
                    createdBy: 'user-1',
                    childIds: [],
                    auditTrail: [],
                    isDeleted: false,
                }]
            },
        }).as('getRangeWithHandover');

        cy.visit('/dashboard');
        cy.wait('@getRangeWithHandover');

        cy.get('[data-testid="next-up-handover"]').should('be.visible');
        cy.contains('Handover at').should('be.visible');
    });
});
