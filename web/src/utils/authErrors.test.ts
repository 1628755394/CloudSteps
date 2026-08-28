import { describe, expect, it } from "vitest";
import { formatAuthErrorMessage } from "./authErrors";

describe("formatAuthErrorMessage", () => {
  it("maps username has exists", () => {
    expect(formatAuthErrorMessage("username has exists")).toBe(
      "该账号已存在，请换一个用户名",
    );
  });

  it("maps prefixed backend errors", () => {
    expect(formatAuthErrorMessage("auth.go:584: username has exists")).toBe(
      "该账号已存在，请换一个用户名",
    );
  });

  it("keeps Chinese messages", () => {
    expect(formatAuthErrorMessage("请完成图形验证码")).toBe("请完成图形验证码");
  });

  it("uses fallback when empty", () => {
    expect(formatAuthErrorMessage("", "注册失败")).toBe("注册失败");
  });

  it("maps unauthorized login", () => {
    expect(formatAuthErrorMessage("unauthorized")).toBe("账号或密码错误");
  });

  it("maps username min length", () => {
    expect(formatAuthErrorMessage("min:2")).toBe("账号至少 2 个字符");
  });
});
