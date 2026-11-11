
export interface Equipment {
  id: number
  assetCode: string
  name: string
  category: string
  description: string
  availability: 'Available' | 'Unavailable'
}
