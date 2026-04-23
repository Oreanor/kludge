export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  source?: 'telegram' | 'preview-picker' | 'extension'
}

export interface PickedElement {
  selector: string
  tagName: string
  rect: { width: number; height: number; top: number; left: number }
  styles: Record<string, string>
  crossOrigin?: boolean
}

export interface ModelOption {
  id: string
  label: string
  provider?: string
}

export interface FolderItem {
  name: string
  path: string
  depth: number
}

export const STREAMING_ID = '__streaming__'
