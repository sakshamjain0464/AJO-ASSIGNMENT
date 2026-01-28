import dotenv from 'dotenv'

dotenv.config()

interface Config {
  port: number
  redisHost: string
  redisPort: number
  nodeEnv: string
  redisPassword: string
}

function getEnvVar (key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`)
  }
  return value
}

export const config: Config = {
  port: parseInt(getEnvVar('PORT', '3000'), 10),
  redisHost: getEnvVar('REDIS_HOST', 'localhost'),
  redisPort: parseInt(getEnvVar('REDIS_PORT', '6379'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  redisPassword: getEnvVar('REDIS_PASSWORD', 'localhost')
}
