import { describe, expect, it, beforeEach } from "vitest";
import {
  appendStudyRoundSessionId,
  clearStudyRoundSessionIds,
  getStudyRoundSessionIds,
  takeStudyRoundSessionIdsForReport,
} from "./studyRoundSessions";

function installMemorySessionStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    },
  });
}

describe("studyRoundSessions", () => {
  beforeEach(() => {
    installMemorySessionStorage();
  });

  it("appends unique snowflake ids across rounds", () => {
    appendStudyRoundSessionId("1640459405329695232");
    appendStudyRoundSessionId("1640459405329695233");
    appendStudyRoundSessionId("1640459405329695232");
    expect(getStudyRoundSessionIds()).toEqual([
      "1640459405329695232",
      "1640459405329695233",
    ]);
  });

  it("includes current id when finishing even if list empty", () => {
    expect(takeStudyRoundSessionIdsForReport("99")).toEqual(["99"]);
  });

  it("clears round ids", () => {
    appendStudyRoundSessionId("1");
    clearStudyRoundSessionIds();
    expect(getStudyRoundSessionIds()).toEqual([]);
  });
});
