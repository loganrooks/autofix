import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { chai } from '../testSetup';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { TestHelper } from '../testHelper';

export async function run(): Promise<void> {
    // Setup chai plugins
    chai.use(chaiAsPromised);
    chai.use(sinonChai);

    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 60000
    });

    // Setup global hooks in root suite
    mocha.suite.beforeEach(() => {
        TestHelper.reset();
    });

    mocha.suite.afterEach(async () => {
        await TestHelper.getInstance().cleanup();
    });

    const testsRoot = path.resolve(__dirname, '..');
    
    try {
        // Find all test files
        const files = await glob('**/**.test.js', { 
            cwd: testsRoot,
            ignore: ['**/node_modules/**', '**/suite/**']
        });

        // Load test files into mocha
        for (const f of files) {
            mocha.addFile(path.resolve(testsRoot, f));
        }

        // Run tests
        return new Promise<void>((resolve, reject) => {
            mocha.run(failures => {
                failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve();
            });
        });
    } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
    }
}