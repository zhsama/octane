# @octanejs/resizable-panels

Octane-native bindings for
[`react-resizable-panels@4.12.0`](https://github.com/bvaughn/react-resizable-panels).
The package keeps the upstream layout, constraint, pointer, keyboard, cursor,
ARIA, and imperative APIs while replacing the React component layer with
Octane.

```sh
pnpm add @octanejs/resizable-panels
```

```tsrx
import { Group, Panel, Separator } from '@octanejs/resizable-panels';

export function Workspace() @{
  <Group orientation="horizontal">
    <Panel id="editor" defaultSize="70%" minSize="30%">
      Editor
    </Panel>
    <Separator aria-label="Resize editor" />
    <Panel id="preview" defaultSize="30%" minSize="20%">
      Preview
    </Panel>
  </Group>
}
```

The complete upstream public surface is available: `Group`, `Panel`,
`Separator`, their imperative handle and prop types, `useDefaultLayout`, the
typed ref hooks, and `isCoarsePointer`.

## Octane adaptations

- Components and contexts run on Octane; refs are ordinary props.
- DOM handlers receive native browser events.
- The framework-neutral upstream layout engine is retained at the pinned
  version.

Panel sizes, constraints, collapsing, pointer and keyboard resizing, ARIA
values, callbacks, persistence, and imperative methods otherwise follow
upstream 4.12.0.

`useDefaultLayout` follows upstream by defaulting `storage` to the browser's
`localStorage`. When rendering that hook on the server, pass a server-safe
`LayoutStorage` implementation explicitly; omitting `storage` requires the
`localStorage` global and is client-only.
