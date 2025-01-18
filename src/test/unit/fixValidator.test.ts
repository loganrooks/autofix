import { FixValidator } from '../../utils/fixValidator';
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

describe('FixValidator', () => {
    let validator: FixValidator;

    beforeEach(() => {
        validator = new FixValidator();
    });

    it('should reject identical code', async () => {
        const code = 'const x = 1;';
        const result = await validator.validateFix(code, code);
        expect(result).to.be.false;
    });

    it('should reject fixes with too large length difference', async () => {
        const original = 'const x = 1;';
        const fix = 'const x = 1;\n'.repeat(20); // Much longer fix
        const result = await validator.validateFix(original, fix);
        expect(result).to.be.false;
    });

    it('should accept valid fixes', async () => {
        const original = 'const x = 1';
        const fix = 'const x = 1;'; // Added semicolon
        const result = await validator.validateFix(original, fix);
        expect(result).to.be.true;
    });

    it('should reject fixes with low similarity', async () => {
        const original = 'function add(a, b) { return a + b; }';
        const fix = 'class Calculator { multiply(x, y) { return x * y; } }';
        const result = await validator.validateFix(original, fix);
        expect(result).to.be.false;
    });
});