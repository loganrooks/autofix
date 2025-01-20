import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import path from 'path';
// Fix: Use dynamic import for nyc
import type { default as NYC } from 'nyc';


const baseConfig = require('@istanbuljs/nyc-config-typescript');
const NYCLib = require('nyc');

// Configure chai plugins
chai.use(chaiAsPromised);
chai.use(sinonChai);

export function setupCoverage(): NYC {
    const nyc = new NYCLib({
        ...baseConfig,
        cwd: path.join(__dirname, '..', '..'),
        reporter: ['text-summary', 'html'],
        all: true,
        silent: false,
        instrument: true,
        hookRequire: true,
        hookRunInContext: true,
        hookRunInThisContext: true,
        include: ["out/**/*.js"],
        exclude: ["out/test/**"]
    });

    return nyc;
}

export { chai };