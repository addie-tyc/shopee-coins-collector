import { Cookie } from 'puppeteer';

export interface ShopeeCredential {
    login: string | undefined;
    pwd: string | undefined;
    cookies: Cookie[];
  }
