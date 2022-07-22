import { Protocol } from 'puppeteer'

export interface ShopeeCredential {
    login: string | undefined;
    pwd: string | undefined;
    cookies: Protocol.Network.Cookie[];
  }
