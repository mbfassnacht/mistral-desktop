import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw err
  }
}

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  // Unique per call so concurrent writes to the same filePath never race on
  // a shared tmp name (one call's rename removing the file another is about
  // to rename).
  const tmpPath = `${filePath}.${randomUUID()}.tmp`
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tmpPath, filePath)
}
