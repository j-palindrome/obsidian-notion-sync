import { Setting, ToggleComponent } from 'obsidian'
import { useEffect, useRef } from 'react'
import invariant from 'tiny-invariant'

export default function Toggle({
	callback,
	title,
	value,
}: {
	callback: (state: boolean) => void
	title: string
	value: boolean
}) {
	const frame = useRef<HTMLDivElement>(null)
	const thisToggle = useRef<ToggleComponent | null>(null)
	const thisSetting = useRef<Setting | null>(null)

	useEffect(() => {
		invariant(frame.current)
		if (!thisSetting.current) {
			thisSetting.current = new Setting(frame.current).setName(title)
		}
		thisSetting.current.addToggle((toggle) => {
			thisToggle.current = toggle
			toggle.setValue(value)
			toggle.onChange((state) => callback(state))
		})
		return () => {
			thisSetting.current?.clear()
		}
	}, [])

	useEffect(() => {
		thisToggle.current?.setValue(value)
	}, [value])

	return <div ref={frame} className='p-1 font-menu child:pb-0'></div>
}
