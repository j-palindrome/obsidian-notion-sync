import { useEffect } from 'react'
import Api from '../api'
import { parseTitle } from '../functions/parser'
import { Setting, ToggleComponent } from 'obsidian'
import Toggle from '../../../../packages/obsidian-components/Toggle'
import _ from 'lodash'

export default function App({ obsidianApi }: { obsidianApi: Api }) {
	const apiKey = obsidianApi.settings.apiKey
	useEffect(() => {}, [apiKey])

	if (!apiKey)
		return (
			<div>
				<p>Please set an API key before adding files.</p>
				<h2>Steps:</h2>
				<ol>
					<li>
						Go to{' '}
						<a href="https://www.notion.so/my-integrations">
							the Notion integrations website
						</a>{' '}
						and click "Create New Integration."
					</li>
					<li>Name it "Notion Sync." The logo is not necessary.</li>
					<li>
						Copy the "Internal Integration Secret" and paste it into
						the "Api Key" setting above.
					</li>
				</ol>
			</div>
		)

	return (
		<div className="font-regular">
			{_.sortBy(Object.values(obsidianApi.databases), (database) =>
				parseTitle(database)
			).map((database) => {
				const title = parseTitle(database)

				return (
					<div className="mb-1 flex">
						<div className="w-1/2 flex-none">{title}</div>
						<input
							defaultValue={
								obsidianApi.settings.files[database.id]?.path ??
								''
							}
							className="w-1/2"
							type="text"
							spellCheck="false"
							placeholder="no folder selected"
							onBlur={(ev) =>
								obsidianApi.updateFile(database.id, {
									path: ev.target.value,
								})
							}
						></input>
					</div>
				)
			})}
		</div>
	)
}
