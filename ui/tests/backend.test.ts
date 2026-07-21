import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  emailIdentityHash,
  identityHash,
  identityUserKey,
  telegramIdentityHash,
} from "../lib/identity";
import { priceFor, averageActionCost, getPricing, PRICING_AMOUNTS } from "../lib/pricing";
import { isDemoMode } from "../lib/demo-mode";
import { isPaymentCurrency, formatAmount } from "../lib/payment-currency";
import { bufferedSettlementFee, getSettlementConfig } from "../lib/settlement-config";

describe("identity", () => {
  it("hashes namespaced email without exposing raw value on-chain shape", () => {
    const a = emailIdentityHash("alice@example.com");
    const b = emailIdentityHash("ALICE@example.com");
    assert.equal(a, b);
    assert.match(a, /^0x[a-f0-9]{64}$/);
    assert.notEqual(a, identityHash("email", "bob@example.com"));
  });

  it("separates telegram and email namespaces", () => {
    const tg = telegramIdentityHash("12345678");
    const email = emailIdentityHash("12345678");
    assert.notEqual(tg, email);
  });

  it("derives a stable non-custodial on-chain user key", () => {
    const hash = emailIdentityHash("alice@example.com");
    assert.equal(identityUserKey(hash), identityUserKey(hash));
    assert.match(identityUserKey(hash), /^0x[a-fA-F0-9]{40}$/);
  });
});

describe("pricing", () => {
  it("returns positive prices for all action types", () => {
    assert.ok(priceFor("mention_reply") > 0);
    assert.ok(averageActionCost() > 0);
  });

  it("includes currency in pricing rows", () => {
    const rows = getPricing("USDm");
    assert.ok(rows.every((r) => r.currency === "USDm"));
  });

  it("scales prices down in demo mode", () => {
    const prev = process.env.DEMO_MODE;
    process.env.DEMO_MODE = "true";
    assert.equal(priceFor("mention_reply"), PRICING_AMOUNTS.mention_reply / 100);
    process.env.DEMO_MODE = prev;
    assert.equal(isDemoMode(), prev === "true");
  });
});

describe("payment currency", () => {
  it("accepts only supported currencies", () => {
    assert.equal(isPaymentCurrency("USDm"), true);
    assert.equal(isPaymentCurrency("BTC"), false);
  });

  it("formats amounts with currency label", () => {
    assert.match(formatAmount(1.5, "USDm"), /USDm/);
  });
});

describe("settlement config", () => {
  it("loads configurable thresholds from env defaults", () => {
    const config = getSettlementConfig();
    assert.ok(config.mode === "instant" || config.mode === "batch");
    assert.ok(config.monetaryThreshold > 0);
    assert.ok(config.actionThreshold >= 1);
    assert.ok(config.intervalMinutes >= 1);
    assert.ok(config.feeEstimate > 0);
    assert.ok(config.feeBufferPercent >= 0);
  });

  it("applies a configurable settlement fee buffer", () => {
    const prevEstimate = process.env.SETTLEMENT_FEE_ESTIMATE;
    const prevBuffer = process.env.SETTLEMENT_FEE_BUFFER_PERCENT;
    process.env.SETTLEMENT_FEE_ESTIMATE = "0.01";
    process.env.SETTLEMENT_FEE_BUFFER_PERCENT = "10";
    assert.ok(Math.abs(bufferedSettlementFee() - 0.011) < 1e-12);
    process.env.SETTLEMENT_FEE_ESTIMATE = prevEstimate;
    process.env.SETTLEMENT_FEE_BUFFER_PERCENT = prevBuffer;
  });
});
