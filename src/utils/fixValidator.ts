import * as ts from 'typescript';


export interface ValidationRule {
    name: string;
    validate(code: string): boolean;
}

export class FixValidator {
    private rules: ValidationRule[];
    private readonly MAX_LENGTH_DIFF_RATIO = 3.0;  // Max allowed length difference
    private readonly MIN_SIMILARITY_RATIO = 0.6;   // Min required similarity


    constructor(customRules: ValidationRule[] = []) {
        // Ensure custom rules are added after built-in rules
        this.rules = [
            {
                name: 'syntaxCheck',
                validate: (code: string): boolean => {
                    try {
                        return this.isValidCode(code);
                    } catch {
                        return false;
                    }
                }
            },
            ...customRules // Spread custom rules after built-in rules
        ];
    }

    async validateFix(originalCode: string, fixedCode: string): Promise<boolean> {
        if (!originalCode || !fixedCode) {
            return false;
        }

        try {
            // Basic validation checks first
            if (originalCode === fixedCode && !this.isValidCode(fixedCode)) {
                return false;
            }

            // Length validation
            const lengthRatio = Math.max(
                originalCode.length / fixedCode.length,
                fixedCode.length / originalCode.length
            );
            if (lengthRatio > this.MAX_LENGTH_DIFF_RATIO) {
                return false;
            }

            // Code validation
            if (!this.isValidCode(fixedCode)) {
                return false;
            }

            // Similarity check
            const similarity = this.calculateSimilarity(originalCode, fixedCode);
            if (similarity < this.MIN_SIMILARITY_RATIO) {
                return false;
            }

            // Apply each validation rule sequentially
            for (const rule of this.rules) {
                try {
                    // Handle both sync and async validation
                    const result = rule.validate(fixedCode);
                    const isValid = await Promise.resolve(result);
                    if (!isValid) {
                        return false;
                    }
                } catch (error) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    private calculateSimilarity(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix: number[][] = Array(len1 + 1).fill(null)
            .map(() => Array(len2 + 1).fill(0));

        for (let i = 0; i <= len1; i++) matrix[i][0] = i;
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        const distance = matrix[len1][len2];
        const maxLength = Math.max(len1, len2);
        return 1 - distance / maxLength;
    }

    private isValidCode(code: string): boolean {
        try {
            // First try as a complete statement/declaration
            try {
                new Function(code);
                return true;
            } catch {
                // If that fails, try as an expression
                try {
                    new Function(`return (${code})`);
                    return true;
                } catch {
                    // Finally try TypeScript validation
                    const sourceFile = ts.createSourceFile(
                        'test.ts',
                        code,
                        ts.ScriptTarget.Latest,
                        true
                    );
    
                    // Create a proper CompilerHost
                    const host: ts.CompilerHost = {
                        fileExists: () => true,
                        readFile: () => code,
                        getSourceFile: (fileName) => 
                            fileName === 'test.ts' ? sourceFile : undefined,
                        writeFile: () => {},
                        getCurrentDirectory: () => '',
                        getCanonicalFileName: (f: string) => f,
                        useCaseSensitiveFileNames: () => true,
                        getNewLine: () => '\n',
                        getDefaultLibFileName: () => 'lib.d.ts'
                    };
    
                    const program = ts.createProgram({
                        rootNames: ['test.ts'],
                        options: {
                            target: ts.ScriptTarget.Latest,
                            module: ts.ModuleKind.CommonJS,
                            noEmit: true
                        },
                        host
                    });
    
                    const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
                    return diagnostics.length === 0;
                }
            }
        } catch {
            return false;
        }
    }
}
