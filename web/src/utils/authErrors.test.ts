/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { formatAuthErrorMessage } from "./authErrors";

describe("formatAuthErrorMessage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("maps username has exists", () => {
    expect(formatAuthErrorMessage("username has exists")).toBe(i18n.t("auth.username_exists"));
  });

  it("maps prefixed backend errors", () => {
    expect(formatAuthErrorMessage("auth.go:584: username has exists")).toBe(
      i18n.t("auth.username_exists"),
    );
  });

  it("passes through already-localized messages", () => {
    expect(formatAuthErrorMessage(i18n.t("validation.captcha_required"))).toBe(
      i18n.t("validation.captcha_required"),
    );
  });

  it("uses fallback when empty", () => {
    expect(formatAuthErrorMessage("", i18n.t("login.register_failed"))).toBe(
      i18n.t("login.register_failed"),
    );
  });

  it("maps unauthorized login", () => {
    expect(formatAuthErrorMessage("unauthorized")).toBe(i18n.t("auth.invalid_credentials"));
  });

  it("returns raw message when no mapping exists", () => {
    expect(formatAuthErrorMessage("min:2")).toBe("min:2");
  });
});
