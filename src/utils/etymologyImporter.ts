import { importEtymologyData } from '@/db'

interface EtymologyRecord {
  word: string
  etymology_summary: string
  etymology_cognates: string[]
}

export async function loadAndImportEtymologyData(): Promise<void> {
  try {
    const response = await fetch('/etymology_data_sample.jsonl')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const text = await response.text()
    const lines = text.split('\n').filter(Boolean) // Filter out empty lines

    const etymologyRecords: EtymologyRecord[] = lines.map((line) => JSON.parse(line))

    console.log(`Importing ${etymologyRecords.length} etymology records...`)
    await importEtymologyData(etymologyRecords)
    console.log('Etymology data imported successfully into IndexedDB.')
  } catch (error) {
    console.error('Failed to load and import etymology data:', error)
  }
}
