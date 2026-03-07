describe('Session Security & Auto-Lock', () => {
    beforeEach(() => {
        // Mock initial state
        cy.intercept('GET', '**/auth/me', {
            fixture: 'user-me.json',
            statusCode: 200
        }).as('getMe');

        // Set a short timeout in localStorage
        localStorage.setItem('session_timeout', '120');

        cy.visit('/dashboard');
        cy.get('[data-testid="loading-spinner"]').should('be.visible');
        cy.wait('@getMe');
        cy.get('[data-testid="loading-spinner"]').should('not.exist');
    });

    it('should show the session timer and decrement time', () => {
        cy.clock();
        cy.get('[data-testid="security-timer"]').should('be.visible');
        cy.get('[data-testid="timer-countdown"]').then(($el) => {
            const initialTime = $el.text();
            cy.tick(1000);
            cy.get('[data-testid="timer-countdown"]').should('not.have.text', initialTime);
        });
    });

    it('should reset timer when refresh button is clicked', () => {
        cy.clock();
        cy.tick(15000); // Wait 15s
        cy.get('[data-testid="timer-countdown"]').should('not.contain', '2:00');

        cy.get('[data-testid="timer-refresh"]').click();
        cy.tick(100);
        cy.get('[data-testid="timer-countdown"]').should('contain', '2:00');
    });

    it('should auto-lock session when timer expires', () => {
        // Use a 2s timeout for this individual test
        localStorage.setItem('session_timeout', '2');
        cy.visit('/dashboard');
        cy.wait('@getMe');

        // Check for locked state via data-testid
        cy.get('[data-testid="locked-status"]', { timeout: 10000 }).should('exist');
        cy.get('[data-testid="locked-status"]').should('contain', 'Locked');
    });

    it('should show access denied toast when trying to perform action while locked', () => {
        localStorage.setItem('session_timeout', '2');
        cy.visit('/dashboard');
        cy.wait('@getMe');

        cy.get('[data-testid="locked-status"]', { timeout: 10000 }).should('exist');

        // Click Add Event
        cy.contains('button', 'Add Event').click({ force: true });

        // Check for toast text
        cy.get('body').should('contain', 'Access Denied');
    });

    it('should allow unlocking from settings', () => {
        localStorage.setItem('session_timeout', '2');
        cy.visit('/settings');
        cy.wait('@getMe');

        // Stub navigator.credentials.get for WebAuthn
        cy.window().then((win) => {
            cy.stub(win.navigator.credentials, 'get').resolves({
                id: 'mock-id',
                rawId: new Uint8Array([1, 2, 3]).buffer,
                type: 'public-key',
                response: {
                    clientDataJSON: new Uint8Array([1, 2, 3]).buffer,
                    authenticatorData: new Uint8Array([1, 2, 3]).buffer,
                    signature: new Uint8Array([1, 2, 3]).buffer,
                    userHandle: new Uint8Array([1, 2, 3]).buffer
                },
                getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array(32).buffer } } })
            });
        });

        // Wait for lock
        cy.get('[data-testid="session-lock-status"]', { timeout: 10000 }).should('contain', 'Locked');

        // Mock options
        cy.intercept('POST', '**/auth/login/options', {
            body: {
                challenge: 'mock-challenge',
                allowCredentials: [],
                timeout: 60000
            }
        }).as('loginOptions');

        // Mock successful unlock
        cy.intercept('POST', '**/auth/login/verify', {
            body: {
                verified: true,
                userId: 'user-123',
                encryptedRsaPrivateKeyBase64: 'mock-key',
                prfSaltBase64: 'mock-salt'
            }
        }).as('verifyUnlock');

        // Click unlock button
        cy.get('[data-testid="unlock-button"]').click();

        cy.wait('@loginOptions');
        cy.wait('@verifyUnlock');

        // Check that it's now unlocked
        cy.get('[data-testid="session-lock-status"]').should('contain', 'Unlocked');
    });
});
