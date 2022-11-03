import { PuppeteerLaunchOptions } from 'puppeteer';
import { getCookies } from './lib/config';
import { BaseCrawler } from './lib/crawlers/BaseCrawler';
import { ShopeeCrawler } from './lib/crawlers/ShopeeCrawler';

async function main () {
  const opt: PuppeteerLaunchOptions = {
    // devtools: true
  };

  const crawlers: BaseCrawler[] = [
    new ShopeeCrawler(opt, { }, getCookies())
  ];

  await Promise.all(crawlers.map(cr => cr.run()));
}

(async () => main())();
