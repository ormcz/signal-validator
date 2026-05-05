export type Tags = Record<string, string>;
export type Validator = (tags: Tags) => string | boolean | null;

export type ValidatorName = string;
export type ValidationError = {
    name: ValidatorName;
    message?: string | null;
};

export class ValidationManager {
    private validators: Map<ValidatorName, Validator> = new Map();

    getNames(): ValidatorName[] {
        return [ ... this.validators.keys() ]
    }

    add(name: ValidatorName, validator: Validator): void {
        if (this.validators.has(name)) {
            throw new Error(`Validator "${name}" already exists`);
        }
        this.validators.set(name, validator);
    }

    remove(name: ValidatorName): void {
        this.validators.delete(name);
    }

    validate(tags: Tags, onlyNames?: ValidatorName[]): ValidationError[] {
        const errors: ValidationError[] = [];

        const entries = onlyNames
            ? onlyNames.map(name => [name, this.validators.get(name)] as const)
            : Array.from(this.validators.entries());

        for (const [name, validator] of entries) {
            if (!validator) continue;

            const message = validator(tags);
            if (message === true) {
                errors.push({name, message: null});
            } else if (typeof message === 'string') {
                errors.push({ name, message });
            }
        }

        return errors;
    }
}




