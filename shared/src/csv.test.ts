import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvToObjects } from "./csv";

describe("parseCsv", () => {
  it("splits plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('Name,Note\n"Smith, John","Says ""hi"""')).toEqual([
      ["Name", "Note"],
      ["Smith, John", 'Says "hi"'],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("parseCsvToObjects maps header to values", () => {
    expect(parseCsvToObjects("Name,SKU\nWidget,W-1")).toEqual([{ Name: "Widget", SKU: "W-1" }]);
  });
});
