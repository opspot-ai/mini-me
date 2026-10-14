import { Type } from "typebox";
const identityKey = "~miniMeClosedObjectIdentity";
export function closedObject(properties) {
    const schema = Type.Object(properties, { additionalProperties: false });
    Object.defineProperty(schema, identityKey, { value: Symbol("closedObject") });
    return schema;
}
