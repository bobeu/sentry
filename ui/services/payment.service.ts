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

const ENV_TOKEN: Partial<Record<PaymentCurrency, string | undefined>> = {
  USDm: process.env.CELO_USDM_ADDRESS,
  USDC: process.env.CELO_USDC_ADDRESS,
  USDT: process.env.CELO_USDT_ADDRESS,
};

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
      (["USDm", "USDC", "USDT"] as const).map((currency) => {
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
