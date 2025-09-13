/** @jsx createElement */
/** @jsxRuntime classic */
import { Effect, Data } from "effect";

export class InvalidChildError extends Data.TaggedError("InvalidChildError")<{
  readonly child: unknown;
  readonly childType: string;
  readonly reason: string;
}> {}

export interface VNode {
  type: string | Component<any, any, any>;
  props: Record<string, any>;
  key?: any;
  ref?: any;
}

export type Component<P = any, E = never, R = never> = (props: P) => Effect.Effect<VNode, E, R>;

const createVNode = (
  type: any,
  props: Record<string, any>,
  key?: any,
  ref?: any
) =>
  Effect.succeed<VNode>({
    type,
    props,
    key,
    ref,
  });


declare global {
  namespace JSX {
    type Element = Effect.Effect<VNode, any, any>;
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicElements {
      div: any;
      h1: any;
      p: any;
      span: any;
      button: any;
    }
  }
}


function normalizeChild<C>(
  child: C
): C extends Effect.Effect<any, infer E, infer R>
  ? Effect.Effect<any, E, R>
  : Effect.Effect<any, InvalidChildError, never> {
  if (Effect.isEffect(child)) {
    return child as any;
  } else {
    if (child === null || child === undefined) {
      return Effect.succeed(null) as any;
    } else if (typeof child === "number") {
      return Effect.succeed(child.toString()) as any;
    } else if (typeof child === "string") {
      return Effect.succeed(child) as any;
    } else if (typeof child === "boolean") {
      return Effect.succeed(child.toString()) as any;
    } else {
      return Effect.fail(new InvalidChildError({ child, childType: typeof child, reason: "Invalid child" })) as any;
    }
  }
}

// Helper type to extract error type from Effect or default to never
type ExtractError<T> = T extends Effect.Effect<any, infer E, any> ? E : never;

// Helper type to extract requirement type from Effect or default to never  
type ExtractRequirement<T> = T extends Effect.Effect<any, any, infer R> ? R : never;

// Union all error types from children array
type ChildrenErrors<Children extends readonly unknown[]> = {
  [K in keyof Children]: ExtractError<Children[K]>
}[number];

// Union all requirement types from children array
type ChildrenRequirements<Children extends readonly unknown[]> = {
  [K in keyof Children]: ExtractRequirement<Children[K]>
}[number];


// Example createElement function inspired by Preact
export function createElement<
  T extends string | Component<any, any, any>,
  P = T extends Component<infer PP, any, any> ? PP : Record<string, any>,
  Children extends readonly unknown[] = readonly unknown[]
>(
  type: T,
  props: P | null = {} as any,
  ...children: Children
): T extends Component<any, infer E, infer R>
  ? Effect.Effect<VNode, E | ChildrenErrors<Children>, R | ChildrenRequirements<Children>>
  : Effect.Effect<VNode, ChildrenErrors<Children>, ChildrenRequirements<Children>> {
  
  const effect = Effect.gen(function* () {
    let normalizedProps: any = {};
    let key, ref;

    for (let i in props) {
      if (i === "key") key = (props as any)[i];
      else if (i === "ref" && typeof type !== "function") ref = (props as any)[i];
      else (normalizedProps as any)[i] = (props as any)[i];
    }

    // Normalize children
    if (children.length === 1) {
      normalizedProps.children = yield* normalizeChild(children[0]);
    } else if (children.length > 1) {
      normalizedProps.children = yield* Effect.all(children.map(normalizeChild));
    } else {
      normalizedProps.children = [];
    }

    // If type is a component, run it
    if (typeof type === "function") {
      return yield* (type as any)(normalizedProps);
    }

    return yield* createVNode(type, normalizedProps, key, ref);
  });
  
  return effect as any;
}

class MyCustomError extends Data.TaggedError("MyCustomError")<{}> {}
class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly reason: string
}> {}
class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly entity: string
  readonly id: string
}> {}

const Heading = () =>
  Effect.gen(function* () {
    return yield* <h1>Hello World</h1>;
  });

const Paragraph = ({content}: {content: string}) =>
  Effect.gen(function* () {
    return yield* <p>{content}</p>;
  });

const FailsWithNotFoundError = () =>
  Effect.gen(function* () {
    return yield* Effect.fail(new NotFoundError({ entity: "Item", id: "1" }))
  })


const FailsWithMyCustomError = () =>
  Effect.gen(function* () {
    return yield* Effect.fail(new MyCustomError())
  })

const ValidationFallBack = () =>
  Effect.gen(function* () {
    return yield* <p>Validation failed</p>
  })

const FailsValidation = ({ field, value }: { field: string; value: string }) =>
  Effect.gen(function* () {
    if (value.trim().length === 0) {
      return yield* Effect.fail(
        new ValidationError({ field, reason: "Must not be empty" })
      )
    }
    return yield* <p>{field} is valid: {value}</p>
  }).pipe(
    Effect.catchTag("ValidationError", (error) => {
      return ValidationFallBack()
    })
  )



const App = () =>
  Effect.gen(function* () {
    return yield* (
      <div id="root">
        <Heading />
        <Paragraph content="This is Effect-TS Frontend Framework" />
        <FailsValidation field="username" value="fake123"/>
        <FailsWithMyCustomError/>
        <FailsWithNotFoundError />
      </div>
    );
  });

  

export default App
