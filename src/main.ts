import { Notice, Plugin } from 'obsidian'
import NotionSyncSettingsTab from './NotionSyncSettingsTab'
import Api from './api'
import { DateTime } from 'luxon'

const DEFAULT_SETTINGS: NotionSyncSettings = {
	files: {},
	apiKey: '',
	lastSync: 0,
	lastConflicts: [],
}

export default class NotionSync extends Plugin {
	settings: NotionSyncSettings
	api: Api

	async onload() {
		await this.loadSettings()
		// called from obsidianApi etc.
		this.setSetting = this.setSetting.bind(this)

		this.addSettingTab(new NotionSyncSettingsTab(this))
		this.api = new Api(this.app, this.settings, this.setSetting)

		this.addCommand({
			name: 'Sync',
			callback: () => this.api.sync(),
			id: 'sync',
		})

		this.addCommand({
			name: 'Download all files',
			id: 'force-download',
			callback: async () => {
				this.setSetting({ lastSync: 0 })
				await this.api.sync('download')
			},
		})

		this.addCommand({
			name: 'Upload all files',
			id: 'force-upload',
			callback: async () => {
				this.setSetting({ lastSync: 0 })
				await this.api.sync('upload')
			},
		})
	}

	async loadSettings() {
		this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData())
	}

	async setSetting(settings: Partial<NotionSyncSettings>) {
		for (let key of Object.keys(settings)) {
			this.settings[key] = settings[key]
		}
		await this.saveData(this.settings)
	}
}
