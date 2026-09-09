import { customAlphabet, nanoid } from "nanoid";

export function newId(prefix: string): string {
  return `${prefix}_${nanoid(16)}`;
}

const codeAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 4);

export function newCustomerCode(firstName: string): string {
  const base = (firstName || "Cust").replace(/[^a-zA-Z]/g, "") || "Cust";
  return `${base}-${codeAlphabet()}`;
}
