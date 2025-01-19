import { ProgressHandler } from '../ui/progressHandler';
import { Logger } from './logger';
import * as vscode from 'vscode';

export class BatchProcessor<T> {
    private processing: boolean = false;
    private readonly queue: T[] = [];

    constructor(
        private readonly batchSize: number,
        private readonly processItem: (item: T) => Promise<void>
    ) {}

    async processDocuments(items: T[], processor?: (item: T) => Promise<void>): Promise<void> {
        if (this.processing) {
            throw new Error('Batch processor is already running');
        }

        this.processing = true;
        const itemProcessor = processor || this.processItem;

        try {
            await ProgressHandler.withProgress(
                'Processing documents',
                async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
                    const totalItems = items.length;
                    let processedItems = 0;

                    // Process in batches
                    while (processedItems < totalItems) {
                        const batch = items.slice(
                            processedItems,
                            processedItems + this.batchSize
                        );

                        // Process batch concurrently
                        await Promise.all(
                            batch.map(async (item) => {
                                try {
                                    await itemProcessor(item);
                                } catch (error) {
                                    const errorMessage = error instanceof Error 
                                    ? `Failed to process item: ${error.message}`
                                    : `Failed to process item: ${String(error)}`;
                                Logger.error(errorMessage);
                                }
                            })
                        );

                        processedItems += batch.length;
                        progress.report({
                            increment: (batch.length / totalItems) * 100,
                            message: `Processed ${processedItems}/${totalItems} items`
                        });
                    }
                }
            );
        } finally {
            this.processing = false;
        }
    }

    async add(item: T): Promise<void> {
        this.queue.push(item);
        if (!this.processing) {
            await this.processQueue();
        }
    }

    async processQueue(): Promise<void> {
        this.processing = true;
        
        await ProgressHandler.withProgress(
            'Processing files',
            async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
                try {
                    while (this.queue.length > 0) {
                        const batch = this.queue.splice(0, this.batchSize);
                        Logger.info(`Processing batch of ${batch.length} items`);
                        
                        progress.report({
                            increment: (batch.length / this.queue.length) * 100,
                            message: `Processing ${batch.length} items...`
                        });

                        await Promise.all(
                            batch.map(async item => {
                                try {
                                    await this.processItem(item);
                                } catch (error: unknown) {
                                    const errorMessage = error instanceof Error 
                                        ? `Failed to process item: ${error.message}`
                                        : `Failed to process item: ${String(error)}`;
                                    Logger.error(errorMessage);
                                }
                            })
                        );
                    }
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error
                        ? `Batch processing failed: ${error.message}`
                        : `Batch processing failed: ${String(error)}`;
                    Logger.error(errorMessage);
                } finally {
                    this.processing = false;
                }
            }
        );
    }

    clear(): void {
        this.queue.length = 0;
    }

    get queueLength(): number {
        return this.queue.length;
    }

    get isProcessing(): boolean {
        return this.processing;
    }
}