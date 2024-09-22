import { Notice, Plugin } from 'obsidian'
import NotionSyncSettingsTab from './NotionSyncSettingsTab'
import Api from './api'
import { DateTime } from 'luxon'
import invariant from 'tiny-invariant'

const DEFAULT_SETTINGS: NotionSyncSettings = {
  files: {},
  apiKey: '',
  lastSync: 0,
  lastConflicts: []
}

export default class NotionSync extends Plugin {
  settings: NotionSyncSettings
  api: Api

  async onload() {
    await this.loadSettings()
    // called from obsidianApi etc.
    this.setSetting = this.setSetting.bind(this)

    this.addSettingTab(new NotionSyncSettingsTab(this.app, this))
    this.api = new Api(this.app, this.settings, this.setSetting)

    this.addCommand({
      name: 'Sync',
      callback: () => this.api.sync(),
      id: 'sync'
    })

    this.addCommand({
      name: 'Download all files',
      id: 'force-download',
      callback: async () => {
        this.setSetting({ lastSync: 0 })
        await this.api.sync('download')
      }
    })

    this.addCommand({
      name: 'Download this file',
      id: 'force-download-file',
      editorCallback: async (_editor, ctx) => {
        if (!ctx.file) return
        await this.app.fileManager.processFrontMatter(
          ctx.file,
          async frontmatter => {
            invariant(ctx.file)
            const id = frontmatter['Notion ID']
            if (!id) {
              new Notice('No Notion ID property.')
              return
            }
            const page = await this.api.getPage(id, true)
            await this.api.downloadPage(page, ctx.file, ctx.file.path, true)
            new Notice('Notion sync: downloaded.')
          }
        )
      }
    })

    this.addCommand({
      name: 'Upload this file',
      id: 'force-upload-file',
      editorCallback: async (_editor, ctx) => {
        if (!ctx.file) return
        await this.app.fileManager.processFrontMatter(
          ctx.file,
          async frontmatter => {
            invariant(ctx.file)
            const id = frontmatter['Notion ID']
            if (!id) {
              new Notice('No Notion ID property.')
              return
            }
            await this.api.uploadFile(ctx.file, id, true)
            new Notice('Notion sync: uploaded.')
          }
        )
      }
    })

    this.addCommand({
      name: 'Upload all files',
      id: 'force-upload',
      callback: async () => {
        this.setSetting({ lastSync: 0 })
        await this.api.sync('upload')
      }
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
