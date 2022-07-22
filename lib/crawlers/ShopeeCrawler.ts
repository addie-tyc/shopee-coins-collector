
/* eslint-disable promise/param-names */
/* eslint-disable no-tabs */
import { errors, LaunchOptions, Page } from 'puppeteer'
import { logger } from '../logger'
import { BaseCrawler, ICrawlerOptions } from './BaseCrawler'
import * as txt from '../loginResultTxt'
import * as exitCode from '../exitCode'
import { login, pwd } from '../config'

export class ShopeeCrawler extends BaseCrawler {
  readonly homepage = 'https://shopee.tw/'
  readonly loginpage = 'https://shopee.tw/buyer/login?from=https%3A%2F%2Fshopee.tw%2Fuser%2Fcoin&next=https%3A%2F%2Fshopee.tw%2Fshopee-coins'
  readonly pathCookie: any
  login: string
  pwd: string
  aesKey: string

  constructor (
		readonly launchOptions: LaunchOptions,
		options: ICrawlerOptions = {}) {
    super(launchOptions, options)
    this.login = <string>login
    this.pwd = <string>pwd
  }

  async run () {
    const missingConf = await this.checkConf()
    if (missingConf) {
      throw new Error('Config is not completed. Please check your env or config file.')
    }
    const page = await this.newPage(this.homepage)
    let result: number | undefined = await this.tryLogin(page)
    logger.debug(`login result: ${result}`)
    if (result === exitCode.NEED_SMS_AUTH) {
      // Login failed. Try use the SMS link to login.
      result = await this.tryLoginWithSmsLink(page)
    }
    if (result !== undefined) {
      // Failed to login.
      return result
    }

    // Now we are logged in.

    await this.tryReceiveCoin(page)
    await this.closeBrowser()
    return result
  }

  async tryLogin (page: Page) {
    await page.goto(this.loginpage, { waitUntil: 'load' })
    await this.sleep(5000)

    const curUrl = page.url()
    logger.debug('Currently at url: ' + curUrl)

    const coinUrl = 'https://shopee.tw/shopee-coins'
    if (curUrl === coinUrl) {
      // The webpage is redirected to the coin check-in page which means
      // the user must have been logged in.
      logger.info('Already logged in.')
      return
    }

    logger.info('Try to login by username and password.')
    logger.info('Start to login shopee.')

    const loginIpt = 'input[name=loginKey]'
    await this.waitFor(page, loginIpt)
    const pwdIpt = 'input[name=password]'
    await this.waitFor(page, pwdIpt)
    await page.type(loginIpt, this.login)
    await page.type(pwdIpt, this.pwd)
    await this.clickXPath(page, '//button[contains(text(), "登入")]')

    // Wait for something happens.
    const outcomes = [
      ...txt.WRONG_PASSWORDS.map(e => page.waitForXPath(`//div[contains(text(), "${e}")]`)),
      page.waitForXPath(`//button[contains(text(), "${txt.PKAY_PUZZLE}")]`),
      page.waitForXPath(`//div[contains(text(), "${txt.USE_LINK}")]`),
      page.waitForXPath(`//div[contains(text(), "${txt.REWARD}")]`),
      page.waitForXPath(`//div[contains(text(), "${txt.TOO_MUCH_TRY}")]`),
      page.waitForXPath(`//div[contains(text(), "${txt.EMAIL_AUTH}")]`)
    ]
    const result = await Promise.any(outcomes)
    const text = await page.evaluate(el => el.innerText, result)
    logger.info(text)

    if (text === txt.REWARD) {
      // login succeeded
      logger.info('Login succeeded.')
      return
    }
    if (txt.WRONG_PASSWORDS.includes(text)) {
      // wrong password
      logger.error('Login failed: wrong password.')
      return exitCode.WRONG_CONF
    }
    if (text === txt.PKAY_PUZZLE) {
      // need to play puzzle
      logger.error('Login failed: I cannot solve the puzzle.')
      return exitCode.CANNOT_SOLVE_PUZZLE
    }
    if (text === txt.USE_LINK) {
      // need to authenticate via SMS link
      return exitCode.NEED_SMS_AUTH
    }
    if (text === txt.EMAIL_AUTH) {
      // need to authenticate via email; this is currently not supported
      logger.error('Login failed: need email Auth')
      return exitCode.NEED_EMAIL_AUTH
    }

    // Unknown error
    logger.debug(`Unexpected error occurred. Fetched text by xpath: ${text}`)
    throw new Error('Unknown error occurred when trying to login.')
  }

  async tryLoginWithSmsLink (page: Page): Promise<number | undefined> {
    // Wait until the '使用連結驗證' button is available.
    await page.waitForXPath(`//div[contains(text(), "${txt.USE_LINK}")]`)

    // Click the '使用連結驗證' button.
    await this.clickXPath(page, `//button[contains(., "${txt.USE_LINK}")]`)

    // Wait until the page is redirect.
    await page.waitForFunction("window.location.pathname === '/verify/link'")

    // Check if reaching daily limits.
    try {
      const sentOnPhone = await page.waitForXPath(`//div[contains(text(), "${txt.ON_CELLPHONE}")]`, { visible: true })
      if (!sentOnPhone) {
        // Failed because reach limits.
        logger.error('Cannot use SMS link to login: reach daily limits.')
        return exitCode.TOO_MUCH_TRY
      }
    } catch (e) {
      if (e instanceof errors.TimeoutError) {
        logger.error('Cannot use SMS link to login: reach daily limits.')
        throw e
      }
    }

    // Now user should click the link sent from Shopee to her mobile via SMS.
    // Once completing the process, the website should be redirected to coin page.
    logger.warn('An SMS message is sent to your mobile. Once you click the link I will keep going. I will wait for you and please complete it in 1 minutes.')
    let result: 'success' | 'fail'
    try {
      const success = new Promise<'success'>((res, rej) => {
        page.waitForFunction("window.location.pathname === '/shopee-coins'", { timeout: 70000 })
          .then(() => res('success'))
          .catch(rej)
      })
      const fail = new Promise<'fail'>((res, rej) => {
        page.waitForXPath(`//div[contains(text(), "${txt.FAILURE}")]`, { timeout: 70000 })
          .then(() => res('fail'))
          .catch(rej)
      })
      result = await Promise.any([success, fail])
    } catch (e) {
      // timeout error
      if (e instanceof AggregateError) {
        logger.error('Timeout. Try again and be fast somehow.')
        throw e
      }

      // unexpected error
      throw e
    }

    if (result === 'success') {
      // Login permitted.
      logger.info('Login permitted.')
      return
    }

    // Login denied.
    logger.error('Login denied.')
    return exitCode.LOGIN_DENIED
  }

  private async tryReceiveCoin (page: Page): Promise<number> {
    const receivableXPath = `//button[contains(text(), "${txt.RECEIVE_COIN}")]`
    const receivedXPath = `//button[contains(text(), "${txt.COIN_RECEIVED}")]`
    let status: 'receivable' | 'received'
    try {
      const receivable = new Promise<'receivable'>((res, rej) => {
        page.waitForXPath(receivableXPath, { visible: true })
          .then(() => res('receivable'))
          .catch(rej)
      })
      const received = new Promise<'received'>((res, rej) => {
        page.waitForXPath(receivedXPath, { visible: true })
          .then(() => res('received'))
          .catch(rej)
      })
      status = await Promise.any([receivable, received])
      logger.debug(`coin status: ${status}`)
    } catch (e) {
      if (e instanceof AggregateError && e instanceof errors.TimeoutError) {
        logger.error('Timeout. Try again and be fast somehow.')
        throw e
      }
      throw e
    }

    if (status === 'received') {
      logger.info('You\'ve received coin today.')
      return exitCode.SUCCESS
    }
    this.clickXPath(page, receivableXPath, false)
    await page.waitForXPath(receivedXPath)
    logger.info('Coin received.')
    return exitCode.SUCCESS
  }

  async sleep (ms: number) {
    await new Promise(res => setTimeout(res, ms))
  }

  async checkConf () {
    if (!this.login || !this.pwd) {
      logger.error('Miss `SHOPEE_LOGIN` or `SHOPEE_PWD`')
      return exitCode.WRONG_CONF
    }
  }
}
