import { Group, Panel, Separator } from '@octanejs/resizable-panels';

export function ServerFixture() @{
	<Group id="server-group" orientation="vertical" defaultLayout={{ top: 40, bottom: 60 }}>
		<Panel id="top" defaultSize="40%">
			server top
		</Panel>
		<Separator id="server-separator" aria-label="Resize server panels" />
		<Panel id="bottom" defaultSize="60%">
			server bottom
		</Panel>
	</Group>
}
