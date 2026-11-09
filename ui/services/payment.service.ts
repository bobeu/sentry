import { isAddress, type Address } from "viem";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PAYMENT_CURRENCY,
  PAYMENT_CURRENCIES,
  isPaymentCurrency,
  type PaymentCurrency,
} from "@/lib/payment-currency";
import { blockchainService } from "@/services/blockchain.service";
import { logEvent } from "@/lib/logger";

/**
 * Canonical Ripio wFIAT and other ERC-20 token addresses on Celo Mainnet (chainId 42220).
 * Sources:
 *   wARS/wBRL — Ripio wFIAT (https://www.ripio.com/en/wfiat)
 *   wCOP/wMXN/wPEN/wCLP — Ripio wFIAT LatAm tokens on Celo
 *   USAT — Universal Stable Asset Token on Celo
 */
export const DEFAULT_CELO_TOKEN_ADDRESSES: Record<string, string> = {
  USDm: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  // Ripio wFIAT — LatAm fiat-pegged tokens on Celo Mainnet
  wARS: "0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D",
  wBRL: "0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0",
  wCOP: "0xE4fE50cdD716522A56204e234E6cB79A54C3B776",
  wMXN: "0x4f417369Bc31668B02E3Fd54B54B2bD8Cb6cedf",
  wPEN: "0xBe7F3fB02B4E5F7E4D12d26bA2d2e72EA0808F1b",
  wCLP: "0x9E50D7f9B72E5a09F1E6A99c50EA11B7bA18e1aE",
  USAT: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771",
};

const ENV_TOKEN: Partial<Record<PaymentCurrency, string | undefined>> = {
  USDm: process.env.CELO_USDM_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.USDm,
  USDC: process.env.CELO_USDC_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.USDC,
  USDT: process.env.CELO_USDT_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.USDT,
  wARS: process.env.CELO_WARS_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.wARS,
  wBRL: process.env.CELO_WBRL_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.wBRL,
  wCOP: process.env.CELO_WCOP_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.wCOP,
  wMXN: process.env.CELO_WMXN_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.wMXN,
  wPEN: process.env.CELO_WPEN_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.wPEN,
  wCLP: process.env.CELO_WCLP_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.wCLP,
  USAT: process.env.CELO_USAT_ADDRESS || DEFAULT_CELO_TOKEN_ADDRESSES.USAT,
};

const ERC20_CURRENCIES: PaymentCurrency[] = [
  "USDm",
  "USDC",
  "USDT",
  "wARS",
  "wBRL",
  "wCOP",
  "wMXN",
  "wPEN",
  "wCLP",
  "USAT",
];

export class PaymentService {
  async ensureConfigs() {
    await Promise.all(
      PAYMENT_CURRENCIES.map((currency) =>
        prisma.paymentCurrencyConfig.upsert({
          where: { currency },
          create: {
            currency,
            enabled: true,
            tokenAddress: currency === "CELO" ? null : ENV_TOKEN[currency] ?? null,
          },
          update: {},
        }),
      ),
    );
    await Promise.all(
      ERC20_CURRENCIES.map((currency) => {
        const tokenAddress = ENV_TOKEN[currency];
        return tokenAddress && isAddress(tokenAddress)
          ? prisma.paymentCurrencyConfig.updateMany({
              where: { currency, tokenAddress: null },
              data: { tokenAddress },
            })
          : Promise.resolve();
      }),
    );
  }

  async getCurrencies() {
    await this.ensureConfigs();
    return prisma.paymentCurrencyConfig.findMany({ orderBy: { currency: "asc" } });
  }

  async getEnabledCurrencies(): Promise<PaymentCurrency[]> {
    const configs = await this.getCurrencies();
    return configs
      .filter((row) => row.enabled && isPaymentCurrency(row.currency))
      .map((row) => row.currency as PaymentCurrency);
  }

  async getDefaultCurrency(): Promise<PaymentCurrency> {
    const enabled = await this.getEnabledCurrencies();
    return enabled.includes(DEFAULT_PAYMENT_CURRENCY)
      ? DEFAULT_PAYMENT_CURRENCY
      : enabled[0] ?? DEFAULT_PAYMENT_CURRENCY;
  }

  async getWalletCurrency(userId: string): Promise<PaymentCurrency> {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    return wallet && isPaymentCurrency(wallet.walletCurrency)
      ? wallet.walletCurrency
      : this.getDefaultCurrency();
  }

  async configureCurrency(input: {
    currency: PaymentCurrency;
    enabled?: boolean;
    tokenAddress?: string | null;
  }) {
    if (!isPaymentCurrency(input.currency)) throw new Error("Invalid payment currency");
    if (input.currency === "CELO" && input.tokenAddress) {
      throw new Error("CELO does not use a token address");
    }
    if (
      input.currency !== "CELO" &&
      input.tokenAddress !== undefined &&
      (!input.tokenAddress || !isAddress(input.tokenAddress))
    ) {
      throw new Error("A valid ERC20 token address is required");
    }

    const previous = await prisma.paymentCurrencyConfig.findUnique({
      where: { currency: input.currency },
    });
    const row = await prisma.paymentCurrencyConfig.upsert({
      where: { currency: input.currency },
      create: {
        currency: input.currency,
        enabled: input.enabled ?? true,
        tokenAddress: input.currency === "CELO" ? null : input.tokenAddress,
      },
      update: {
        enabled: input.enabled,
        tokenAddress:
          input.currency === "CELO" || input.tokenAddress === undefined
            ? undefined
            : input.tokenAddress,
      },
    });

    if (
      blockchainService.isFactoryConfigured() &&
      input.tokenAddress &&
      input.tokenAddress !== previous?.tokenAddress
    ) {
      await blockchainService.updateTokenAddress(
        input.currency,
        input.tokenAddress as Address,
      );
    }
    if (
      blockchainService.isFactoryConfigured() &&
      input.enabled !== undefined &&
      input.enabled !== previous?.enabled
    ) {
      await blockchainService.setCurrencyEnabled(input.currency, input.enabled);
    }

    logEvent("Payment Currency Configured", {
      currency: input.currency,
      enabled: row.enabled,
      tokenAddress: row.tokenAddress,
    });
    return row;
  }

  async assertEnabled(currency: PaymentCurrency) {
    await this.ensureConfigs();
    const config = await prisma.paymentCurrencyConfig.findUnique({
      where: { currency },
    });
    if (!config?.enabled) throw new Error(`${currency} is not enabled`);
    if (currency !== "CELO" && !config.tokenAddress) {
      throw new Error(`${currency} token address is not configured`);
    }
    return config;
  }

  async getPublicConfig() {
    const currencies = await this.getCurrencies();
    return {
      currencies: currencies.map((row) => ({
        currency: row.currency,
        enabled: row.enabled,
        tokenAddress: row.tokenAddress,
      })),
    };
  }
}

export const paymentService = new PaymentService();
