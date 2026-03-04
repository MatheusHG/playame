export function encryptStripeKey(key: string): string {
  return Buffer.from(key).toString('base64');
}

export function decryptStripeKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}
