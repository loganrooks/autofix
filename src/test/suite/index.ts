import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { chai } from '../testSetup';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { TestHelper } from '../testHelper';
import { setupCoverage } from '../testSetup';


export async function run(): Promise<void> {
      // Setup coverage pre-test, including post-test hook to report
    let nyc: any;
    if (process.env.COVERAGE) {
        nyc = setupCoverage();
        await nyc.reset();
        await nyc.wrap();
    }
 
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
        const failures: number = await new Promise(resolve => mocha.run(resolve));


        if (process.env.COVERAGE) {
            await nyc.writeCoverageFile();
            console.log(await captureStdout(nyc.report.bind(nyc)));
        }

        if (failures > 0) {
            throw new Error(`${failures} tests failed.`);
          }


    } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
    }
}


async function captureStdout(fn: () => void): Promise<string> {
    let w = process.stdout.write, buffer = '';
    process.stdout.write = (s) => { buffer = buffer + s; return true; };
    await fn();
    process.stdout.write = w;
    return buffer;
  }