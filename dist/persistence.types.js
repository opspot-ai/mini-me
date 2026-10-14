export class MiniMePersistenceError extends Error {
    reason;
    code;
    constructor(reason, message) {
        super(message);
        this.reason = reason;
        this.name = "MiniMePersistenceError";
        this.code = "MINI_ME_" + reason.toUpperCase().replaceAll("-", "_");
    }
}
