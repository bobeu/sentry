path = r'c:\Users\HP\Desktop\proofOfShip\sentry\ui\lib\networks.ts'
content = (
    'export const SUPPORTED_NETWORKS = ["CELO"] as const;\r\n'
    '\r\n'
    'export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];\r\n'
    '\r\n'
    'export const DEFAULT_NETWORK: SupportedNetwork = "CELO";\r\n'
    '\r\n'
    'export function isSupportedNetwork(value: string): value is SupportedNetwork {\r\n'
    '  return SUPPORTED_NETWORKS.includes(value as SupportedNetwork);\r\n'
    '}\r\n'
)
with open(path, 'wb') as f:
    f.write(content.encode('utf-8'))
print('Done: lib/networks.ts')
