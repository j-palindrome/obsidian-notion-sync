import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'

declare global {
	type NotionSyncSettings = {
		files: Record<string, NotionFile>
		apiKey: string
		lastSync: number
		lastConflicts: string[]
	}

	type NotionFile = {
		path: string
	}

	type NotionProperty = PageObjectResponse['properties'][string]
}
