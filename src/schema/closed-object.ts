import { Type, type TProperties } from "typebox";

const identityKey = "~miniMeClosedObjectIdentity";

export function closedObject<Properties extends TProperties>(properties: Properties) {
  const schema = Type.Object(properties, { additionalProperties: false });
  Object.defineProperty(schema, identityKey, { value: Symbol("closedObject") });
  return schema;
}
