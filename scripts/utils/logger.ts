/**
 * Unified logging utility with color support
 * Used by all comparison scripts for consistent output formatting
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export interface LogColors {
  reset: string
  bright: string
  red: string
  green: string
  yellow: string
  blue: string
  cyan: string
}

const COLORS: LogColors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

export class Logger {
  private colors: LogColors

  constructor(useColors = true) {
    this.colors = useColors
      ? COLORS
      : {
          ...COLORS,
          ...Object.keys(COLORS).reduce(
            (acc, key) => ({ ...acc, [key]: '' }),
            {},
          ),
        }
  }

  private colorize(text: string, color: keyof LogColors): string {
    return `${this.colors[color]}${text}${this.colors.reset}`
  }

  debug(message: string): void {
    console.log(this.colorize(`[DEBUG] ${message}`, 'cyan'))
  }

  info(message: string): void {
    console.log(this.colorize(`ℹ ${message}`, 'blue'))
  }

  success(message: string): void {
    console.log(this.colorize(`✓ ${message}`, 'green'))
  }

  warning(message: string): void {
    console.log(this.colorize(`⚠ ${message}`, 'yellow'))
  }

  error(message: string): void {
    console.error(this.colorize(`✗ ${message}`, 'red'))
  }

  box(title: string, color: keyof LogColors = 'blue'): void {
    const line = '═'.repeat(62)
    console.log(this.colorize(`╔${line}╗`, color))
    console.log(this.colorize(`║${title.padEnd(62)}║`, color))
    console.log(this.colorize(`╚${line}╝`, color))
  }

  divider(color: keyof LogColors = 'green'): void {
    console.log(this.colorize('━'.repeat(62), color))
  }

  table(rows: string[][], columnWidths?: number[]): void {
    rows.forEach(row => {
      const formatted = row
        .map((cell, i) => {
          const width = columnWidths?.[i] || 15
          return cell.padEnd(width)
        })
        .join('')
      console.log(formatted)
    })
  }

  blank(): void {
    console.log()
  }
}

export const logger = new Logger()
