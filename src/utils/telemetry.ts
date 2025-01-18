import * as vscode from 'vscode';

interface TelemetryEvent {
    type: string;
    data: Record<string, any>;
    timestamp: number;
}

export class TelemetryReporter {
    private enabled: boolean;
    private events: TelemetryEvent[] = [];
    private readonly maxEvents = 100;

    constructor() {
        this.enabled = vscode.workspace.getConfiguration('copilotAutoFixer')
            .get('telemetryEnabled', true);
    }

    trackEvent(type: string, data: Record<string, any>): void {
        if (!this.enabled) return;

        this.events.push({
            type,
            data,
            timestamp: Date.now()
        });

        if (this.events.length > this.maxEvents) {
            this.flush();
        }
    }

    trackFixAttempt(success: boolean, error?: string): void {
        this.trackEvent('fix_attempt', {
            success,
            error,
            timestamp: Date.now()
        });
    }

    private async flush(): Promise<void> {
        if (this.events.length === 0) return;

        try {
            // In a real implementation, send to telemetry service
            this.events = [];
        } catch (error) {
            console.error('Failed to flush telemetry', error);
        }
    }

    reportUndo(): void {
        this.trackEvent('undo', { timestamp: Date.now() });
    }

    dispose(): void {
        this.flush();
    }
}