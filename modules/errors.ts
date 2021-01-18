/**
 * represents a Error containing a inner Error
 */
class InnerError extends Error {
    innerError: Error;

    /**
     * creates new Error containing a inner Error
     * @param {string} text 
     * @param {Error} innerError 
     */
    constructor(text: string, innerError: Error) {
        super(text);
        // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
        this.name = InnerError.name; // stack traces display correctly now 
        this.innerError = innerError;
    }
}

export default InnerError;
export { InnerError };