export interface ValidationRule {
    name: string;
    validate(code: string): boolean;
}

export class FixValidator {
    private rules: ValidationRule[];
    private readonly MAX_LENGTH_DIFF_RATIO = 2.0;  // Max allowed length difference
    private readonly MIN_SIMILARITY_RATIO = 0.6;   // Min required similarity


    constructor(customRules: ValidationRule[] = []) {
        this.rules = [
            {
                name: 'syntaxCheck',
                validate: (code: string): boolean => {
                    try {
                        Function('return ' + code);
                        return true;
                    } catch {
                        return false;
                    }
                }
            },
            ...customRules
        ];
    }

    async validateFix(originalCode: string, fixedCode: string): Promise<boolean> {
        // Reject if codes are identical
        if (originalCode === fixedCode) {
            return false;
        }

        // Check length difference
        const lengthRatio = Math.max(
            originalCode.length / fixedCode.length,
            fixedCode.length / originalCode.length
        );
        if (lengthRatio > this.MAX_LENGTH_DIFF_RATIO) {
            return false;
        }

        // Calculate similarity ratio (simple implementation)
        const similarity = this.calculateSimilarity(originalCode, fixedCode);
        if (similarity < this.MIN_SIMILARITY_RATIO) {
            return false;
        }

        // Run existing validation rules
        return this.rules.every(rule => rule.validate(fixedCode));
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
}
