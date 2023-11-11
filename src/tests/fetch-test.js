async function main() {
	console.log(
		await (
			await fetch(
				'https://api.notion.com/v1/pages/86201649-9fed-43a5-8a1a-89b623f26014',
				{
					method: 'PATCH',
					headers: {
						Authorization: `Bearer secret_1EJHsJ5oSTQVBMOKteTtavn09j206ifY9Y4XwRLqUKO`,
						'Notion-Version': '2022-06-28',
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: JSON.stringify({
						properties: {
							Place: {
								select: {
									name: 'New York',
								},
							},
							Completed: {
								checkbox: false,
							},
							Status: {
								status: {
									name: 'Not started',
								},
							},
							Description: {
								rich_text: [
									{
										type: 'text',
										text: {
											content: '',
										},
									},
								],
							},
							Genre: {
								multi_select: [
									{
										name: 'Music',
									},
									{
										name: 'Philosophy',
									},
									{
										name: 'Writing',
									},
								],
							},
							Relationship: {
								multi_select: [
									{
										name: 'Artist',
									},
									{
										name: 'Thinker',
									},
								],
							},
							'Contact (# Months)': {
								select: {
									name: '',
								},
							},
						},
					}),
				}
			)
		).json()
	)
}

main()
