import { describe, it, expect } from "vitest";
import { normalizePhoneDigits, phoneNumbersMatch } from "./phone";

describe("phone normalization", () => {
  it("'bawan' style digits query and international-stored number match", () => {
    const stored = "009647701470374";
    const query = "0770147";
    expect(normalizePhoneDigits(stored).includes(normalizePhoneDigits(query))).toBe(true);
  });

  it("phoneNumbersMatch is true for the acceptance-test pair", () => {
    expect(phoneNumbersMatch("009647701470374", "0770147")).toBe(true);
  });

  it("ignores spaces and plus signs", () => {
    expect(normalizePhoneDigits("+964 770 147 0374")).toBe("9647701470374");
  });

  it("unrelated numbers do not match", () => {
    expect(phoneNumbersMatch("009647701470374", "0123456")).toBe(false);
  });
});
