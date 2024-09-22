import { Client } from '@notionhq/client'
import {
  DatabaseObjectResponse,
  PageObjectResponse,
  PropertyItemObjectResponse,
  UserObjectResponse
} from '@notionhq/client/build/src/api-endpoints'
import {
  App,
  Component,
  Modal,
  Notice,
  App as ObsidianApp,
  RequestUrlParam,
  TAbstractFile,
  TFile,
  TFolder,
  normalizePath,
  parseLinktext,
  request
} from 'obsidian'

import invariant from 'tiny-invariant'
import {
  getFileName,
  parsePageTitle,
  parseText,
  yamlToMarkdown,
  yamlToNotion
} from './functions/parser'
import NotionSync from './main'
import { DateTime } from 'luxon'
import _ from 'lodash'
import { DataArray, Literal, PageMetadata, getAPI } from 'obsidian-dataview'
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { log } from 'console'

export type Progress = {
  conflicting: { page: PageObjectResponse; tFile: TFile }[]
  skipped: string[]
  uploaded: string[]
  downloaded: string[]
  failed: string[]
}
export default class Api extends Component {
  settings: NotionSyncSettings
  app: ObsidianApp
  setSetting: NotionSync['setSetting']
  client: Client
  databases: Record<string, DatabaseObjectResponse>
  people: Record<string, UserObjectResponse>
  pages: Record<string, PageObjectResponse>
  progress: Progress

  async load() {
    this.databases = await this.loadDatabases()
  }

  async sync(force?: 'download' | 'upload') {
    new Notice('Notion Sync: syncing...')

    this.progress = {
      failed: [],
      conflicting: [],
      uploaded: [],
      downloaded: [],
      skipped: []
    }

    const loadedDatabases = Object.values(this.databases).filter(
      db => this.settings.files[db.id]?.path
    )
    const promises: Promise<any>[] = []
    for (let database of loadedDatabases) {
      promises.push(this.syncDatabase(database.id, force))
    }

    await Promise.all(promises)

    this.setSetting({ lastSync: Date.now() })

    new Notice(
      `Sync successful.\nDownloaded: ${this.progress.downloaded.length}\nUploaded: ${this.progress.uploaded.length}\nSkipped: ${this.progress.skipped.length}\nCheck console for details.`
    )
    if (this.progress.conflicting.length > 0) {
      const modal = new Modal(this.app)
      const content = createRoot(modal.contentEl)

      const SyncStatus = (conflicting: Progress['conflicting']) => {
        return (
          <>
            <div>Conflicts:</div>
            <div>
              {conflicting.map((conflict, i) => (
                <div className='flex w-full items-center space-x-2'>
                  <p key={conflict.tFile.path}>{conflict.tFile.basename}</p>
                  <div className='grow' />
                  <button
                    onClick={async () => {
                      await this.uploadFile(conflict.tFile, conflict.page.id)
                      const newConflicting = conflicting
                        .slice(0, i)
                        .concat(conflicting.slice(i + 1))
                      if (newConflicting.length === 0) {
                        modal.close()
                        new Notice('All conflicts resolved.')
                      } else content.render(SyncStatus(newConflicting))
                    }}>
                    upload
                  </button>
                  <button
                    onClick={async () => {
                      await this.downloadPage(
                        conflict.page,
                        conflict.tFile,
                        conflict.tFile.parent?.path ?? '/'
                      )

                      const newConflicting = conflicting
                        .slice(0, i)
                        .concat(conflicting.slice(i + 1))

                      if (newConflicting.length === 0) {
                        modal.close()
                        new Notice('All conflicts resolved.')
                      } else content.render(SyncStatus(newConflicting))
                    }}>
                    download
                  </button>
                </div>
              ))}
            </div>
            <div>
              These files have been modified in both Notion and Obsidian; please
              fix by using "upload" or "download" after reviewing the
              differences.
            </div>
          </>
        )
      }

      content.render(SyncStatus([...this.progress.conflicting]))
      modal.onClose = () => {
        content.unmount()
      }
      modal.open()
    }
  }

  async createFile(givenPath: string) {
    const path = normalizePath(givenPath + '.md').replace(/:/g, ' -')
    let writeFile = this.app.vault.getAbstractFileByPathInsensitive(path)

    if (!(writeFile instanceof TFile)) {
      const folders = path.split('/').slice(0, -1)
      let currentFolder = ''
      for (let i = 0; i < folders.length; i++) {
        currentFolder += '/' + folders[i]
        const folderVault = this.app.vault.getAbstractFileByPathInsensitive(
          normalizePath(currentFolder)
        )
        if (!(folderVault instanceof TFolder)) {
          try {
            await this.app.vault.createFolder(currentFolder)
          } catch (err) {
            console.warn('error:', err.message)
          }
        }
      }
      writeFile = await this.app.vault.create(path, '')
    }

    return writeFile
  }

  async getPerson(personId: string) {
    if (this.people[personId]) return this.people[personId]
    const person = await this.request<Client['users']['retrieve']>({
      url: `https://api.notion.com/v1/users/${personId}`
    })
    this.people[personId] = person
    return person
  }

  async getPage(pageId: string, skipCache = false) {
    if (this.pages[pageId] && !skipCache) return this.pages[pageId]
    const page = (await this.request<Client['pages']['retrieve']>({
      url: `https://api.notion.com/v1/pages/${pageId}`
    })) as PageObjectResponse
    this.pages[pageId] = page
    return page
  }

  async uploadFile(tFile: TFile, page_id: string, skipProgress = false) {
    const page: PageObjectResponse = await this.getPage(page_id)
    const [nameKey, name] = parsePageTitle(page)
    await this.app.fileManager.processFrontMatter(tFile, frontmatter => {
      const notionProperties: Record<string, any> = {}
      for (let key of Object.keys(frontmatter).filter(
        key => page.properties[key] !== undefined
      )) {
        const parsedProperty = yamlToNotion(
          page.properties[key].type,
          frontmatter[key]
        )
        if (
          parsedProperty !== undefined &&
          !_.isEqual(
            parsedProperty,
            page.properties[key][page.properties[key].type]
          )
        ) {
          notionProperties[key] = {
            [page.properties[key].type]: parsedProperty
          }
        }
      }

      if (name !== tFile.basename) {
        notionProperties[nameKey] = {
          title: [{ text: { content: tFile.basename } }]
        }
      }

      if ((_.keys(notionProperties).length = 0)) {
        this.progress.skipped.push(tFile.path)
        return
      }

      this.request({
        url: `https://api.notion.com/v1/pages/${page.id}`,
        method: 'PATCH',
        body: {
          properties: notionProperties
        }
      }).catch(err => {
        console.error('error:', `https://api.notion.com/v1/pages/${page.id}`, {
          properties: notionProperties
        })
      })
    })
    if (!skipProgress) this.progress.uploaded.push(name)
    console.info('uploaded', name)
  }

  async downloadPage(
    page: PageObjectResponse,
    tFile: TAbstractFile | null,
    path: string,
    skipProgress = false
  ) {
    const [nameKey, name] = parsePageTitle(page)
    if (!(tFile instanceof TFile)) {
      tFile = await this.createFile(path + '/' + name)
    }
    invariant(tFile instanceof TFile)

    if (tFile.basename !== name) {
      console.log('mismatch names', tFile.basename, name)
      await this.app.vault.rename(
        tFile,
        tFile.parent?.path + '/' + name + '.md'
      )
    }

    const convertedProperties = Object.entries(await this.notionToYaml(page))

    await this.app.fileManager.processFrontMatter(tFile, frontmatter => {
      for (let [key, value] of convertedProperties) {
        if (value === name) continue
        frontmatter[key] = value
      }
      frontmatter['Notion ID'] = page.id
    })

    if (!skipProgress) this.progress.downloaded.push(name)
    console.info('downloaded', name)
  }

  async notionToYaml(page: PageObjectResponse) {
    const yamlProperties: Record<string, string> = {}
    for (let [propertyKey, property] of Object.entries(page.properties)) {
      yamlProperties[propertyKey] = await this.parseProperty(property)
    }
    return yamlProperties
  }

  async parseProperty(property: PageObjectResponse['properties'][string]) {
    const fromISO = (string: string) => string.slice(0, 16)

    const parseDate = (
      date: (PropertyItemObjectResponse & { type: 'date' })['date']
    ) =>
      !date
        ? ''
        : date.end
        ? {
            start: fromISO(date.start),
            end: fromISO(date.end)
          }
        : fromISO(date.start)

    switch (property.type) {
      case 'checkbox':
        return property.checkbox ? true : false
      case 'created_by':
      case 'last_edited_by':
        return (await this.getPerson(property[property.type].id)).name
      case 'date':
        return parseDate(property.date)
      case 'email':
        return property.email ?? ''
      case 'files':
        return property.files.map(file => file.name)
      case 'formula':
        switch (property.formula.type) {
          case 'boolean':
            return property.formula ? 'true' : 'false'
          case 'date':
            return parseDate(property.formula.date)
          case 'number':
            return String(property.formula.number)
          case 'string':
            return property.formula.string ?? ''
        }
      case 'last_edited_time':
      case 'created_time':
        return fromISO(property[property.type])
      case 'multi_select':
        return property.multi_select.map(item => item.name)
      case 'number':
        return String(property.number)
      case 'people':
        return (
          await Promise.all(
            property.people.map(person => this.getPerson(person.id))
          )
        ).map(user => user.name ?? '')

      case 'phone_number':
      case 'url':
        return property[property.type] ?? ''
      case 'relation':
        return (
          await Promise.all(
            property.relation.map(value => this.getPage(value.id))
          )
        ).map(page => '[[' + parsePageTitle(page) + ']]')
      case 'rich_text':
      case 'title':
        return parseText(property[property.type])
      case 'rollup':
        switch (property.rollup.type) {
          case 'array':
            return await Promise.all(
              property.rollup.array.map(property =>
                this.parseProperty({ ...property, id: '' })
              )
            )
          case 'date':
            return parseDate(property.rollup.date)
          case 'number':
            return property.rollup.number
        }
      case 'select':
        const name = property[property.type]?.name
        return name ?? ''
      case 'status':
        return property[property.type]?.name ?? ''
      case 'unique_id':
        return (
          property.unique_id.prefix ?? '' + String(property.unique_id.number)
        )
      case 'verification':
        return property.verification?.date
          ? parseDate(property.verification.date) ?? ''
          : ''
    }
  }

  async syncDatabase(databaseId: string, force?: 'download' | 'upload') {
    const database = this.settings.files[databaseId]

    if (!database.path) return

    const lastSync = DateTime.fromMillis(this.settings.lastSync)
    const lastSyncISO = lastSync.toISO()

    let pages: PageObjectResponse[] = []

    let newPages: { results: PageObjectResponse[] }
    let start_cursor = undefined
    do {
      newPages = await this.request({
        url: `https://api.notion.com/v1/databases/${databaseId}/query`,
        method: 'POST',
        body: {
          start_cursor,
          filter:
            force === 'download'
              ? undefined
              : {
                  timestamp: 'last_edited_time',
                  last_edited_time: {
                    after: lastSyncISO
                  }
                }
        }
      }).catch(err => console.warn('error:', err))
      start_cursor = newPages['next_cursor']
      pages.push(...newPages.results)
    } while (newPages['has_more'])

    let dv = getAPI()
    if (!dv) {
      new Notice('Please install Dataview to use Notion Sync.')
      throw new Error('Dataview must be installed')
    }

    const files = dv.pages(`"${database.path}"`) as DataArray<
      Record<string, Literal> & { file: PageMetadata }
    >

    const uploading =
      force === 'download'
        ? []
        : force === 'upload'
        ? files
        : files.filter(file => file.file.mtime > lastSync)
    const databasePath =
      normalizePath(this.settings.files[databaseId].path) + '/'

    for (let page of pages) {
      const pageTitle = parsePageTitle(page)
      const file = files.find(file => file['Notion ID'] === page.id)
      const tFile = this.app.vault.getAbstractFileByPathInsensitive(
        file ? file.file.path : databasePath + pageTitle + '.md'
      )
      if (
        force !== 'download' &&
        tFile &&
        tFile.stat.mtime > this.settings.lastSync
      ) {
        this.progress.conflicting.push({
          page,
          tFile
        })
      } else {
        await this.downloadPage(page, tFile, database.path)
      }
    }

    for (let file of uploading) {
      const tFile = this.app.vault.getAbstractFileByPathInsensitive(
        file.file.path
      )
      invariant(tFile)
      if (!file['Notion ID']) {
        const page = await this.request({
          url: `https://api.notion.com/v1/pages`,
          body: {
            parent: { database_id: databaseId },
            properties: {
              Name: {
                title: [{ text: { content: tFile.basename } }]
              }
            }
          },
          method: 'POST'
        })
        await this.app.fileManager.processFrontMatter(
          tFile,
          frontmatter => (frontmatter['Notion ID'] = page.id)
        )
        await this.uploadFile(tFile, page.id as string)
      } else await this.uploadFile(tFile, file['Notion ID'] as string)
    }
  }

  constructor(
    app: ObsidianApp,
    settings: Api['settings'],
    setSetting: Api['setSetting']
  ) {
    super()
    this.app = app
    this.settings = settings
    this.setSetting = setSetting
    this.people = {}
    this.pages = {}
    this.load()
  }

  async request<T extends (args: any) => any>(
    config: Omit<RequestUrlParam, 'body'> & {
      body?: Partial<Parameters<T>[0]>
    }
  ): Promise<Awaited<ReturnType<T>>> {
    const result = await request({
      ...config,
      headers: {
        Authorization: `Bearer ${this.settings.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: config.body ? JSON.stringify(config.body) : undefined
    }).catch(err => {
      console.warn('error:', err)
    })
    if (!result) {
      console.trace()
      throw 'no result'
    }

    return JSON.parse(result)
  }

  async loadDatabases() {
    const search = await this.request<Client['search']>({
      url: 'https://api.notion.com/v1/search',
      method: 'POST',
      body: {
        filter: { property: 'object', value: 'database' }
      }
    })

    const databases = Object.fromEntries(
      search.results.map((database: DatabaseObjectResponse) => [
        database.id,
        database
      ])
    )
    return databases
  }

  updateFile(id: string, file: NotionFile) {
    const defaultFile: NotionFile = {
      path: ''
    }

    const oldFile: NotionFile = {
      ...defaultFile,
      ...this.settings.files[id]
    }

    this.setSetting({
      files: {
        ...this.settings.files,
        [id]: { ...this.settings.files[id], ...file }
      }
    })

    if (oldFile.path !== file.path) {
      const oldFileObject = this.app.vault.getAbstractFileByPath(
        normalizePath(oldFile.path + '/' + getFileName(oldFile.path) + '.md')
      )

      if (oldFileObject && !file.path) {
        this.app.vault.delete(oldFileObject)
      } else if (!oldFileObject && file.path) {
        this.createFile(file.path + '/' + getFileName(file.path))
      } else if (oldFileObject && file.path) {
        const parent = this.app.vault.getAbstractFileByPath(
          normalizePath(oldFile.path)
        )
        if (!parent) return
        this.app.fileManager.renameFile(
          oldFileObject,
          normalizePath(file.path + '/' + getFileName(file.path) + '.md')
        )
        this.app.vault.rename(parent, file.path)
      }
    }
  }
}
