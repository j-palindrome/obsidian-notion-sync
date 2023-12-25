# Notion Sync
Notion Sync allows you to easily two-way sync an Obsidian folder with a Notion database, keeping file properties in sync. 

Notion is a great database platform, and nothing in Obsidian can fully replace its ease of use. Notion Sync exists to seamlessly link Obsidian with Notion, enabling Notion's searching, filtering, and interface to be used with Obsidian file properties.

**NOTE:** This plugin is only for syncing **properties** between Obsidian and Notion. File content will not be changed. 

# Requirements
This plugin requires the [Dataview](obsidian://show-plugin?id=dataview) plugin to function. Thanks Dataview!

# Link a database
1. Create an access token for Notion Sync by visiting [My Integrations](https://www.notion.so/my-integrations) and selecting "New Integration." You can name it anything — we suggest "Notion Sync." An integration secret will be generated, which gives permission for Notion Sync to access databases you add. 
2. In the next page under "Internal Integration Secret," click "Show," then "Copy."
3. Paste the integration secret into the Notion Sync "Notion Integration Secret" setting. 
4. Back in Notion, click on a database's options (the three dots icon in the top-right) and go to "Add connections" under the "Connections" section. Search for "Notion Sync" (or whatever you named the integration) and to connect it to the database. 
5. In Obsidian, reopen the Settings window and the database's name will appear in Notion Sync settings. Select a path to an empty folder you would like to sync to. Once selected, Notion Sync will create a folder there if it doesn't exist already.
6. In the Obsidian Command Palette, use "Notion Sync: Download all files" to download the database to Obsidian. 

# Sync a database
- Use "Notion Sync: Sync" to sync any changes since the last time the command was called. The most recent version (Obsidian or Notion) will be synced. If any files have been modified in **both** Obsidian and Notion since the last sync, you will have the option to choose to upload or download them.
- Use "Notion Sync: Download/Upload all files" to perform a clean upload/download of every file in the databases you've added. 
- Use "Notion Sync: Download/Upload this file" to sync a single file.

# Internet Requests
The sync uses the following API routes in Notion:
- `GET`, `POST`, and `PATCH` to [https://api.notion.com/v1/pages](https://developers.notion.com/reference/post-page) to get, set, and create pages.
- `POST` to [https://api.notion.com/v1/databases/{database_id}/query](https://developers.notion.com/reference/post-database-query) to search available pages.
- `GET` to [https://api.notion.com/v1/users/{user_id}](https://developers.notion.com/reference/get-user) to get names of users, when the "User" property exists in pages.

# Acknowledgements
This plugin uses the excellent Notion API to sync files, as well as the Dataview plugin to query relevant metadata.