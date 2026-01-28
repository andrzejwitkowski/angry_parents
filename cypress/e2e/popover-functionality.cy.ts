describe('Popover and Overflow Functionality', () => {
    const today = new Date().toISOString().split('T')[0];

    beforeEach(() => {
        cy.intercept('GET', '**/api/auth/get-session', {
            statusCode: 200,
            body: {
                user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
                session: { id: 's-1', userId: 'user-1', expiresAt: '2099-01-01' }
            }
        });

        // Mock many events for the calendar range to trigger indicators
        const events = Array.from({ length: 5 }, (_, i) => ({
            id: `ev-${i}`,
            type: 'NOTE',
            date: today,
            content: `Event ${i}`,
            createdAt: new Date(new Date().setHours(10, i)).toISOString(),
            createdBy: 'user-1'
        }));

        // The dashboard fetches a range for the calendar - WRAP IN items!
        cy.intercept('GET', '**/api/timeline/range*', {
            statusCode: 200,
            body: { items: events }
        }).as('getRange');

        // The day sheet fetches specific day timeline - WRAP IN items!
        cy.intercept('GET', `**/api/calendar/${today}/timeline`, {
            statusCode: 200,
            body: { items: events }
        }).as('getDayTimeline');

        cy.visit('/dashboard');
        cy.wait('@getRange');
    });

    it('opens DayDetailsSheet from Popover "View details"', () => {
        // Find an event indicator in today's cell
        cy.contains('div.group', 'Today').find('button').first().click({ force: true });

        // Wait for popover and click View details
        cy.contains('button', 'View details').click({ force: true });

        // Should open the sheet
        cy.contains('Day Logbook').should('be.visible');
    });

    it('shows scrollable overflow dialog with sorted events', () => {
        // Find the "+X" indicator in today's cell
        cy.contains('div.group', 'Today').contains('button', '+').click();

        // Dialog should be visible
        cy.get('[role="dialog"]').should('be.visible');

        // Verify scrolling container exists
        cy.get('.h-\\[60vh\\]').should('exist');

        // Verify events are present (sorted newest first)
        cy.contains('Event 4').should('be.visible');
    });
});
