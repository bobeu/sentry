export type ChannelCommandDefinition = {
  name: string;
  description: string;
  telegram: { enabled: boolean };
  discord?: {
    type: 1;
    options: ReadonlyArray<{
      name: "text";
      description: string;
      type: 3;
      required: true;
    }>;
  };
};

const CHANNEL_COMMAND_DEFINITIONS = [
  {
    name: "start",
    description: "Open Sentry employer help",
    telegram: { enabled: true },
  },
  {
    name: "menu",
    description: "Employer action menu",
    telegram: { enabled: true },
  },
  {
    name: "help",
    description: "What Sentry can do",
    telegram: { enabled: true },
  },
  {
    name: "status",
    description: "Employment and wallet status",
    telegram: { enabled: true },
  },
  {
    name: "mywallet",
    description: "Employment wallet and deposit address",
    telegram: { enabled: true },
  },
  {
    name: "balance",
    description: "Available employment balance",
    telegram: { enabled: true },
  },
  {
    name: "deposit",
    description: "How to fund your employment wallet",
    telegram: { enabled: true },
  },
  {
    name: "groups",
    description: "List your enabled Telegram groups",
    telegram: { enabled: true },
  },
  {
    name: "report",
    description: "Recent work report",
    telegram: { enabled: true },
  },
  {
    name: "askbot",
    description: "AskBot earn cycle (grand admin)",
    telegram: { enabled: true },
  },
  {
    name: "poll",
    description: "Start a poll in this group",
    telegram: { enabled: true },
  },
  {
    name: "trivia",
    description: "Start trivia in this group",
    telegram: { enabled: true },
  },
  {
    name: "points",
    description: "Your points in this group",
    telegram: { enabled: true },
  },
  {
    name: "mystatus",
    description: "Member status in this group",
    telegram: { enabled: true },
  },
  // Discord retains OpenClaw /ask registration; Telegram menu uses Sentry commands above.
  {
    name: "ask",
    description: "Ask the AI a question",
    telegram: { enabled: false },
    discord: {
      type: 1 as const,
      options: [
        {
          name: "text" as const,
          description: "Your question",
          type: 3 as const,
          required: true as const,
        },
      ],
    },
  },
] as const satisfies readonly ChannelCommandDefinition[];

export function getChannelCommandDefinitions(): readonly ChannelCommandDefinition[] {
  return CHANNEL_COMMAND_DEFINITIONS;
}
