import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, '.');

    try {
        // Find test files
        const files = await glob('**/**.test.ts', { cwd: testsRoot });

        // Add files to test suite
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        // Run tests
        return new Promise<void>((resolve, reject) => {
            try {
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
    }
}