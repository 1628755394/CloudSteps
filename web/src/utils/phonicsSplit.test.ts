import { describe, expect, it } from "vitest";
import { getPhonicsParts, splitIpaParts } from "./phonicsSplit";

describe("phonicsSplit", () => {
  it("splits ipa into phonetic chips including clusters", () => {
    expect(splitIpaParts("/ˈbəʊlstə/")).toEqual(["b", "əʊ", "l", "st", "ə"]);
  });

  it("uses phonetic only even when syllables exist", () => {
    const p = getPhonicsParts({ syllables: "bol-ster", phonetic: "/ˈbəʊlstə/" });
    expect(p?.kind).toBe("ipa");
    expect(p?.parts).toEqual(["b", "əʊ", "l", "st", "ə"]);
  });

  it("returns null without phonetic", () => {
    expect(getPhonicsParts({ syllables: "bol-ster", phonetic: "" })).toBeNull();
  });
});
