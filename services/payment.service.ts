import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PAYMENT_CURRENCY,
  isPaymentCurrency,
  type PaymentCurrency,
} from "@/lib/payment-currency";
import { blockchainService } from "@/services/blockchain.service";
import { logEvent } from "@/lib/logger";

export class PaymentService {
  async getActiveCurrency(): Promise<PaymentCurrency> {
    const row = await prisma.paymentConfig.findUnique({ where: { id: "global" } });
    const currency = row?.activeCurrency ?? DEFAULT_PAYMENT_CURRENCY;
    if (!isPaymentCurrency(currency)) return DEFAULT_PAYMENT_CURRENCY;
    return currency;
  }

  async setActiveCurrency(currency: PaymentCurrency) {
    if (!isPaymentCurrency(currency)) {
      throw new Error("Invalid payment currency");
    }

    await prisma.paymentConfig.upsert({
      where: { id: "global" },
      create: { id: "global", activeCurrency: currency },
      update: { activeCurrency: currency },
    });

    await blockchainService.setActivePaymentToken(currency).catch((err) => {
      console.warn("[payment] on-chain currency update skipped", err);
    });

    logEvent("Payment Currency Updated", { currency });
    return { currency };
  }

  async getPublicConfig() {
    const currency = await this.getActiveCurrency();
    return { currency };
  }
}

export const paymentService = new PaymentService();
