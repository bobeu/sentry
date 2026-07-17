export type User = {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

export type EmploymentStatus = "Inactive" | "Active" | "Paused" | "Exhausted";

export type Wallet = {
  id: string;
  userId: string;
  address: string;
  balance: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Employment = {
  id: string;
  userId: string;
  status: EmploymentStatus;
  startedAt: Date | null;
  pausedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Settings = {
  id: string;
  userId: string | null;
  displayName: string | null;
  timeZone: string;
  autoResume: boolean;
  emailNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
};
