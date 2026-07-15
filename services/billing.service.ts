export class BillingService {
  getStatus() {
    return {
      active: false,
      message: "Billing is not implemented yet",
    };
  }
}

export const billingService = new BillingService();
