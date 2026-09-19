import { symbolFor } from './currencies';

export const rs = (n: number, currency = 'PKR') => `${symbolFor(currency)} ${Math.round(n).toLocaleString('en-US')}`;
