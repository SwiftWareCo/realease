# Agent Project Rules

## Typing Source Of Truth

- Prefer Convex-generated function types as the primary source of truth in frontend code.
- Use `FunctionReturnType<typeof api...>` for query/action return shapes.
- Use `FunctionArgs<typeof api...>` for mutation/action argument shapes.
- Use `Doc<"...">` only when working with raw table documents from Convex DB reads/writes.
- Avoid duplicating backend payload types manually in UI code when they can be inferred from Convex function references.
- If a new manual type is being considered only to resolve type errors, stop and ask the user first with a short explanation.
