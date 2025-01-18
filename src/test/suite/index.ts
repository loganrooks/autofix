import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 60000  // Increased timeout
    });

    // Look in parent directory to find all test files
    const testsRoot = path.resolve(__dirname, '..');

    try {
        // Find test files in both unit/ and integration/ directories
        const files = await glob('**/*.test.js', { 
            cwd: testsRoot
        });

        console.log('Found test files:', files);

        // Add files to test suite
        files.forEach(f => {
            console.log('Adding test file:', path.resolve(testsRoot, f));
            mocha.addFile(path.resolve(testsRoot, f));
        });

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