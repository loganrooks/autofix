export enum ErrorType {
    SYNTAX,
    RUNTIME,
    TYPE,
    COMPILATION,
    UNKNOWN
}

export class ErrorClassifier {
    classify(error: string): ErrorType {
        if (error.includes('SyntaxError')) return ErrorType.SYNTAX;
        if (error.includes('TypeError')) return ErrorType.TYPE;
        if (error.includes('RuntimeError')) return ErrorType.RUNTIME;
        if (error.includes('error TS')) return ErrorType.COMPILATION;
        return ErrorType.UNKNOWN;
    }
}
