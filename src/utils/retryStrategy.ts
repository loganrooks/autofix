export class RetryStrategy {
    private readonly baseDelay: number = 1000;
    private readonly maxDelay: number = 10000;

    async retry<T>(
        operation: () => Promise<T>,
        maxAttempts: number
    ): Promise<T> {
        let lastError: Error = new Error('Operation failed');
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error 
                    ? error 
                    : new Error(error instanceof Object ? JSON.stringify(error) : String(error));
                    
                if (attempt === maxAttempts) break;
                
                const delay = Math.min(
                    this.baseDelay * Math.pow(2, attempt - 1),
                    this.maxDelay
                );
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }
}