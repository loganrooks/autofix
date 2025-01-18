export class CopilotError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'CopilotError';
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class FixApplicationError extends Error {
    constructor(message: string, public readonly fix: string) {
        super(message);
        this.name = 'FixApplicationError';
    }
}

export class WorkspaceTrustError extends Error {
    constructor() {
        super('Workspace must be trusted to run Copilot AutoFixer');
        this.name = 'WorkspaceTrustError';
    }
}
