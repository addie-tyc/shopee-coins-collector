import * as path from 'path'
import winston = require('winston')
import { logger } from './logger'

function getEnv (key: string): string | undefined {
  const envKey = process.env[key]
  if (envKey) {
    return envKey
  };
  logger.error(`Missing env: \`${key}\``, winston.error)
}

export function getCookies (): string | undefined {
  const cookie = process.env.COOKIE || 'env.cookie'
  return cookie && path.resolve(cookie)
}

export const login = getEnv('SHOPEE_LOGIN')
export const pwd = getEnv('SHOPEE_PWD')
export const aesKey = getEnv('AES_KEY')
