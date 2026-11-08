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
import { isPaymentCurrency, formatAmount, tokenDecimals } from "../lib/payment-currency";
import { CELO_ATTRIBUTION_TAG, CELO_ATTRIBUTION_SUFFIX } from "../lib/attribution";
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
  it("accepts only supported currencies including LatAm tokens and USAT", () => {
    assert.equal(isPaymentCurrency("USDm"), true);
    assert.equal(isPaymentCurrency("wARS"), true);
    assert.equal(isPaymentCurrency("wBRL"), true);
    assert.equal(isPaymentCurrency("USAT"), true);
    assert.equal(isPaymentCurrency("BTC"), false);
  });

  it("assigns correct token decimals", () => {
    assert.equal(tokenDecimals("CELO"), 18);
    assert.equal(tokenDecimals("USDm"), 18);
    assert.equal(tokenDecimals("wARS"), 18);
    assert.equal(tokenDecimals("wBRL"), 18);
    assert.equal(tokenDecimals("USDC"), 6);
    assert.equal(tokenDecimals("USDT"), 6);
    assert.equal(tokenDecimals("USAT"), 6);
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

describe("fee currency (gas)", () => {
  it("defaults to CELO (no feeCurrency) so existing txs stay unchanged", async () => {
    const prev = process.env.FEE_CURRENCY;
    delete process.env.FEE_CURRENCY;
    const { getTxFeeCurrency, getFeeCurrencyMode, txFeeOpts } = await import(
      "../lib/fee-currency"
    );
    assert.equal(getFeeCurrencyMode(), "celo");
    assert.equal(getTxFeeCurrency(), undefined);
    assert.deepEqual(txFeeOpts(), {});
    process.env.FEE_CURRENCY = prev;
  });

  it("resolves a stable feeCurrency when FEE_CURRENCY=stable", async () => {
    const prevMode = process.env.FEE_CURRENCY;
    const prevStable = process.env.FEE_CURRENCY_STABLE;
    const prevAddr = process.env.FEE_CURRENCY_ADDRESS;
    const prevUsdm = process.env.CELO_USDM_ADDRESS;
    process.env.FEE_CURRENCY = "stable";
    process.env.FEE_CURRENCY_STABLE = "USDC";
    delete process.env.FEE_CURRENCY_ADDRESS;
    const { getTxFeeCurrency, getFeeCurrencyMode, getStableFeeToken, txFeeOpts } =
      await import("../lib/fee-currency");
    assert.equal(getFeeCurrencyMode(), "stable");
    assert.equal(getStableFeeToken(), "USDC");
    assert.equal(
      getTxFeeCurrency()?.toLowerCase(),
      "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B".toLowerCase(),
    );
    assert.ok(txFeeOpts().feeCurrency);
    process.env.FEE_CURRENCY = prevMode;
    process.env.FEE_CURRENCY_STABLE = prevStable;
    process.env.FEE_CURRENCY_ADDRESS = prevAddr;
    process.env.CELO_USDM_ADDRESS = prevUsdm;
  });
});

describe("Agents on Open Rails attribution", () => {
  it("carries the correct hackathon attribution tag", () => {
    assert.equal(CELO_ATTRIBUTION_TAG, "celo_39f96dcb58cc");
  });

  it("formats the exact ERC-8021 suffix expected by Loops", () => {
    assert.equal(
      CELO_ATTRIBUTION_SUFFIX,
      "0x63656c6f5f333966393664636235386363110080218021802180218021802180218021",
    );
  });
});
