import { FixValidator } from '../../utils/fixValidator';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { chai } from '../testSetup';
import { expect } from 'chai';
import sinonChai from 'sinon-chai';
import { TestHelper } from '../testHelper';
import type { ValidationRule } from '../../utils/fixValidator';
import { TestEnvironment } from '../types/testEnvironment';
import { Logger } from '../../utils/logger';

chai.use(sinonChai);

describe('FixValidator', () => {
    const testHelper = TestHelper.getInstance();
    let testEnv: TestEnvironment;
    let validator: FixValidator;

    beforeEach(async () => {
        // Create test environment with configuration
        testEnv = await testHelper.createTestEnvironment({
            stubs: {
                // Add any VS Code API stubs needed
            }
        });

        // Stub logger to prevent actual logging
        testEnv.sandbox.stub(console, 'log');
        testEnv.sandbox.stub(console, 'error');

        // Initialize validator with custom rules
        const mockRule: ValidationRule = {
            name: 'testRule',
            validate: testEnv.sandbox.stub().returns(true)
        };
        validator = new FixValidator([mockRule]);
        await Logger.getInstance().init();
    });

    afterEach(async () => {
        await testHelper.cleanup();
    });

    describe('validateFix', () => {
        it('should reject fixes that are identical to original code, but only if original code isn\'t working', async () => {
            // Arrange
            const original = 'const x = ';
            const fix = 'const x = ';
            
            testEnv.sandbox.stub(validator as any, 'isValidCode').returns(false);
            
            // Act
            const result = await validator.validateFix(original, fix);
            
            // Assert
            expect(result).to.be.false;
        });

        it('should reject fixes with excessive length difference', async () => {
            // Arrange
            const original = 'const x = 1;';
            const fix = 'const x = 1;\n'.repeat(20);
            
            // Act
            const result = await validator.validateFix(original, fix);
            
            // Assert
            expect(result).to.be.false;
        });

        it('should accept valid fixes with reasonable changes', async () => {
            // Arrange
            const original = 'const x = 1';
            const fix = 'const x = 1;';
            
            testEnv.sandbox.stub(validator as any, 'isValidCode').returns(true);
            testEnv.sandbox.stub(validator as any, 'calculateSimilarity').returns(0.9);
            
            // Act
            const result = await validator.validateFix(original, fix);
            
            // Assert
            expect(result).to.be.true;
        });

        it('should reject fixes with low similarity ratio', async () => {
            // Arrange
            const original = 'function add(a, b) { return a + b; }';
            const fix = 'class Calculator { multiply(x, y) { return x * y; } }';
            
            testEnv.sandbox.stub(validator as any, 'calculateSimilarity').returns(0.3);
            
            // Act
            const result = await validator.validateFix(original, fix);
            
            // Assert
            expect(result).to.be.false;
        });

        it('should handle validation errors gracefully', async () => {
            // Arrange
            const original = 'const x = 1;';
            const fix = 'const x = 1;';
            
            testEnv.sandbox.stub(validator as any, 'isValidCode')
                .throws(new Error('Validation error'));
            
            // Act & Assert
            await expect(validator.validateFix(original, fix))
                .to.eventually.be.false;
        });

        it('should apply custom validation rules', async () => {
            // Arrange
            const original = 'const x = 1;';
            const fix = 'const x = 1;';
            const customRule: ValidationRule = {
                name: 'customRule',
                validate: testEnv.sandbox.stub().returns(false)
            };
            const validatorWithCustomRule = new FixValidator([customRule]);
            
            // Act
            const result = await validatorWithCustomRule.validateFix(original, fix);
            
            // Assert
            expect(result).to.be.false;
            expect(customRule.validate).to.have.been.calledWith(fix);
        });
    });

    describe('calculateSimilarity', () => {
        it('should return 1.0 for identical strings', () => {
            // Arrange
            const str = 'test string';
            
            // Act
            const result = validator['calculateSimilarity'](str, str);
            
            // Assert
            expect(result).to.equal(1.0);
        });

        it('should handle empty strings', () => {
            // Arrange
            const emptyStr = '';
            const nonEmptyStr = 'test';
            
            // Act
            const result = validator['calculateSimilarity'](emptyStr, nonEmptyStr);
            
            // Assert
            expect(result).to.be.a('number');
            expect(result).to.be.lessThan(1);
        });
    });

    describe('isValidCode', () => {
        it('should validate syntactically correct code', () => {
            // Arrange
            const validCode = 'const x = 1;';
            
            // Act
            const result = validator['isValidCode'](validCode);
            
            // Assert
            expect(result).to.be.true;
        });

        it('should reject invalid TypeScript code', () => {
            // Arrange
            const invalidCode = 'const x: InvalidType = 1;';
            
            // Act
            const result = validator['isValidCode'](invalidCode);
            
            // Assert
            expect(result).to.be.false;
        });
    });
});