import * as puppeteer from 'puppeteer'
import { Browser, LaunchOptions, Page } from 'puppeteer'
import { logger } from '../logger'
import { wait } from '../util'

export interface ICrawlerOptions {
parallelism?: number
cacheExpirySeconds?: number
}

interface ICrawlerFullOptions extends ICrawlerOptions {
parallelism: number
cacheExpirySeconds: number
}

export const DefaultCrawlerOptions: ICrawlerFullOptions = {
  parallelism: 1,
  cacheExpirySeconds: 3600
}

export abstract class BaseCrawler {
  abstract run(): void;
  protected options: ICrawlerFullOptions

  constructor (
  readonly launchOptions:LaunchOptions,
  options: ICrawlerOptions = {}
  ) {
    this.options = Object.assign({}, DefaultCrawlerOptions, options)

    if (!this.isHeadless(launchOptions)) {
      if (this.options.parallelism !== 1) {
        logger.info('Not headless, capping parallelism to 1')
      }
      this.options.parallelism = 1
    }
  }

  isHeadless (launchOptions: LaunchOptions): boolean {
    if (launchOptions.devtools) {
      return false
    }

    return launchOptions.headless !== false
  }

  // Puppeteer `Browser`
  // One browser per crawler instance

  private _browser: Browser|null = null

  async getBrowser (launchOptions:LaunchOptions = {}): Promise<Browser> {
    if (this._browser === null) {
      const browser = await puppeteer.launch(launchOptions)

      const pages = await browser.pages()
      await Promise.all(pages.map(page => page.close()))
      this._browser = browser
    }
    return this._browser
  }

  async closeBrowser (): Promise<void> {
    if (this._browser) {
      await this._browser.close()
      this._browser = null
    }
  }

  // Puppeteer `Pages`

  async newPage (url: string|undefined): Promise<Page> {
    const browser = await this.getBrowser(this.launchOptions)

    const page = await browser.newPage()
    if (url) {
      await page.goto(url)
    }
    return page
  }

  async closePage (page: Page): Promise<void> {
    await page.close()
  }

  // Puppeteer `ElementNodes`

  async wait (durationMs:number = 0): Promise<void> {
    return wait(durationMs)
  }

  async waitFor (page: Page, selector:string, waitBefore:number = 0, extra?:string): Promise<void> {
    logger.debug(`waitFor: ${selector}`)

    if (waitBefore) {
      await this.wait(waitBefore)
    }

    const timeout = 10000

    for (let i = 0; i < 4; i++) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout })
        break
      } catch (err) {
        i && logger.warn(`[i=${i}, extra=${extra}] waitFor() "${selector}" failed with ${err}`)
      }
    }
  }

  async click (page: Page, selector: string, waitBefore = 0, extra = ''): Promise<void> {
    logger.debug(`click ${selector}`)

    if (waitBefore) {
      await this.wait(waitBefore)
    }

    for (let i = 0; i < 4; i++) {
      try {
        await page.click(selector)
        break
      } catch (err) {
        i && logger.warn(`[i=${i}, extra=${extra}] click() "${selector}" failed with ${err}`)
      }
    }
  }

  async clickXPath (page: Page, selector: string, navigate = true, waitBefore = 0, extra = ''): Promise<void> {
    logger.debug(`click ${selector}`)

    if (waitBefore) {
      await this.wait(waitBefore)
    }
    logger.info(`Looking for the ${selector}`)
    const [btn] = await page.$x(selector)

    for (let i = 0; i < 4; i++) {
      try {
        await btn.click()
        if (navigate) { await page.waitForNavigation({ waitUntil: 'load' }) }
        break
      } catch (err) {
        i && logger.warn(`[i=${i}, extra=${extra}] click() "${selector}" failed with ${err}`)
      }
    }
  }
}
