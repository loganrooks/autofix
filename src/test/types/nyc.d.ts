declare module 'nyc' {
    interface NYC {
        reset(): Promise<void>;
        wrap(): Promise<void>;
        writeCoverageFile(): Promise<void>;
        report(): Promise<void>;
        exclude: {
            shouldInstrument(file: string): boolean;
        };
    }

    interface NYCConfig {
        cwd: string;
        reporter: string[];
        all: boolean;
        silent: boolean;
        instrument: boolean;
        hookRequire: boolean;
        hookRunInContext: boolean;
        hookRunInThisContext: boolean;
        include: string[];
        exclude: string[];
    }

    class NYC {
        constructor(config?: Partial<NYCConfig>);
        reset(): Promise<void>;
        wrap(): Promise<void>;
        writeCoverageFile(): Promise<void>;
        report(): Promise<void>;
        exclude: {
            shouldInstrument(file: string): boolean;
        };
    }

    export = NYC;
}