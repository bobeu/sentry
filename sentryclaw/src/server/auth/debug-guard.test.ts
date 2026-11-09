import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isDebugRoutesEnabled } from "@/server/auth/debug-guard";

describe("isDebugRoutesEnabled", () => {
  it("returns false for undefined", () => {
    assert.equal(isDebugRoutesEnabled(undefined), false);
  });

  it("returns false for empty string", () => {
    assert.equal(isDebugRoutesEnabled(""), false);
  });

  it('returns false for "false"', () => {
    assert.equal(isDebugRoutesEnabled("false"), false);
  });

  it('returns false for "0"', () => {
    assert.equal(isDebugRoutesEnabled("0"), false);
  });

  it('returns false for "no"', () => {
    assert.equal(isDebugRoutesEnabled("no"), false);
  });

  it('returns true for "1"', () => {
    assert.equal(isDebugRoutesEnabled("1"), true);
  });

  it('returns true for "true"', () => {
    assert.equal(isDebugRoutesEnabled("true"), true);
  });

  it('returns true for "yes"', () => {
    assert.equal(isDebugRoutesEnabled("yes"), true);
  });

  it('returns true for "on"', () => {
    assert.equal(isDebugRoutesEnabled("on"), true);
  });

  it("is case-insensitive", () => {
    assert.equal(isDebugRoutesEnabled("TRUE"), true);
    assert.equal(isDebugRoutesEnabled("Yes"), true);
    assert.equal(isDebugRoutesEnabled("On"), true);
  });

  it("trims whitespace", () => {
    assert.equal(isDebugRoutesEnabled("  true  "), true);
    assert.equal(isDebugRoutesEnabled("  false  "), false);
  });
});
