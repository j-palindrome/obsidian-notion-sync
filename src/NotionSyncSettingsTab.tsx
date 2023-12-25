import { Notice, PluginSettingTab, Setting } from 'obsidian'
import NotionSync from './main'
import { Root, createRoot } from 'react-dom/client'
import App from './components/App'

export default class NotionSyncSettingsTab extends PluginSettingTab {
  plugin: NotionSync
  root: Root

  constructor(plugin: NotionSync) {
    super(app, plugin)
    this.plugin = plugin
  }

  async display() {
    let { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('Notion Integration Secret')
      .setDesc(
        'The integration secret to your Notion database (visit notion.so/my-integrations to generate a new key).'
      )
      .addText((text) => {
        text.setValue(this.plugin.settings.apiKey)
        text.onChange((value) => {
          this.plugin.setSetting({ apiKey: value })
          this.renderRoot()
        })
      })

    new Setting(containerEl)
      .setName('Synced Databases')
      .setDesc('Add/remove databases to sync to Obsidian.')

    const names = containerEl.appendChild(createDiv())

    this.root = createRoot(names)
    await this.renderRoot()
  }

  async renderRoot() {
    this.root.render(<App obsidianApi={this.plugin.api} />)
  }
}
