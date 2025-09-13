# Typed JSX Language Tools

### The problem
TypeScript treats JSX tags as `JSX.Element`. Type information of children gets lost.

```tsx
const Option = () =>
  (<option />) as any as "I should be showing below!";

const element = <Option />;

// Today, TypeScript sees this as:
const element: JSX.Element
```
More context: [Type-safe children in React and TypeScript](https://www.totaltypescript.com/type-safe-children-in-react-and-typescript).


But with the **typed-jsx-language-tools** the type is a `string` as it is supposed to be.

![test](images/option-typed-vs-default.png)

_Typed JSX vs Default behaviour_

### The solution
Instead of asking TypeScript to typecheck JSX directly, we:
- Transform JSX into plain TS.
- Get the TypeScript language service to typecheck that TS.
- Map the results back to the original TSX so hovers and diagnostics point to the right place.

This is similar to how Svelte handles `.svelte` files. See the Svelte language tools [overview](https://github.com/sveltejs/language-tools/blob/master/docs/internal/overview.md).


### Why should you care?
Apart from that it improves typesafety of JSX overall.

This allows us to build next level typesafe frontend frameworks.
e.g. Based on [Effect-TS](https://effect.website/)

![Effect-TS-framework](images/app-global-errors.png)

_This doesn't look as nice as React. But have you noticed? We are tracking all
possible ways our UI can fail with in the typesystem. (MyCustomError, ValidationError, NotFoundError)_


![show-fallback](images/catch-specific-error.png)
_We can catch a specific error and show a fallback UI_
And showing fallback UI for different errors, much
more easily.

After we took care of the error we already have two left
![two-errors-left](images/app-after-catching-error.png)

_After handling the ValidationError, typesystem shows two errors that we didn't handle yet._

### Current state
For now this is done through language server. But also a solution should be made
for typechecking at compile time (ts-patch could work)

This thing is barely working. I hope to get back to it whenever I have some free time.

If you have the right skillset to move things further much faster, I would love to be helpful.