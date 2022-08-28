/* eslint-disable */

import { AllTypesProps, ReturnTypes, Ops } from './const';
export const HOST = "https://api-eu-central-1.hygraph.com/v2/cl6pf5b2z20oo01szgaeke2r9/master"


export const HEADERS = {}
export const apiSubscription = (options: chainOptions) => (query: string) => {
  try {
    const queryString = options[0] + '?query=' + encodeURIComponent(query);
    const wsString = queryString.replace('http', 'ws');
    const host = (options.length > 1 && options[1]?.websocket?.[0]) || wsString;
    const webSocketOptions = options[1]?.websocket || [host];
    const ws = new WebSocket(...webSocketOptions);
    return {
      ws,
      on: (e: (args: any) => void) => {
        ws.onmessage = (event: any) => {
          if (event.data) {
            const parsed = JSON.parse(event.data);
            const data = parsed.data;
            return e(data);
          }
        };
      },
      off: (e: (args: any) => void) => {
        ws.onclose = e;
      },
      error: (e: (args: any) => void) => {
        ws.onerror = e;
      },
      open: (e: () => void) => {
        ws.onopen = e;
      },
    };
  } catch {
    throw new Error('No websockets implemented');
  }
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json();
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === 'GET') {
      return fetch(`${options[0]}?query=${encodeURIComponent(query)}`, fetchOptions)
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = '',
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return '';
    }
    if (typeof o === 'boolean' || typeof o === 'number') {
      return k;
    }
    if (typeof o === 'string') {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join('\n');
    }
    const hasOperationName = root && options?.operationName ? ' ' + options.operationName : '';
    const keyForDirectives = o.__directives ?? '';
    const query = `{${Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map((e) => ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars))
      .join('\n')}}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars.map((v) => `${v.name}: ${v.graphQLType}`).join(', ');
    return `${k} ${keyForDirectives}${hasOperationName}${varsString ? `(${varsString})` : ''} ${query}`;
  };
  return ibb;
};

export const Thunder =
  (fn: FetchFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: Record<string, unknown> }) =>
    fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
      ops?.variables,
    ).then((data) => {
      if (graphqlOptions?.scalars) {
        return decodeScalarsInResponse({
          response: data,
          initialOp: operation,
          initialZeusQuery: o as VType,
          returns: ReturnTypes,
          scalars: graphqlOptions.scalars,
          ops: Ops,
        });
      }
      return data;
    }) as Promise<InputType<GraphQLTypes[R], Z, SCLR>>;

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder =
  (fn: SubscriptionFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: ExtractVariables<Z> }) => {
    const returnedFunction = fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
    ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], SCLR>;
    if (returnedFunction?.on && graphqlOptions?.scalars) {
      const wrapped = returnedFunction.on;
      returnedFunction.on = (fnToCall: (args: InputType<GraphQLTypes[R], Z, SCLR>) => void) =>
        wrapped((data: InputType<GraphQLTypes[R], Z, SCLR>) => {
          if (graphqlOptions?.scalars) {
            return fnToCall(
              decodeScalarsInResponse({
                response: data,
                initialOp: operation,
                initialZeusQuery: o as VType,
                returns: ReturnTypes,
                scalars: graphqlOptions.scalars,
                ops: Ops,
              }),
            );
          }
          return fnToCall(data);
        });
    }
    return returnedFunction;
  };

export const Subscription = (...options: chainOptions) => SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: Z | ValueTypes[R],
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    'Content-Type': 'application/json',
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(initialOp as string, ops[initialOp], initialZeusQuery);
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })('Query', response, ['Query']);
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (k: string, o: InputValueType | VType, p: string[] = []): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder = resolvers[currentScalarString.split('.')[1]]?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string' || !o) {
      return o;
    }
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ibb(k, v, [...p, purifyGraphQLKey(k)])]));
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | 'enum'
    | {
        [x: string]:
          | undefined
          | string
          | {
              [x: string]: string | undefined;
            };
      };
};

export type ReturnTypesType = {
  [x: string]:
    | {
        [x: string]: string | undefined;
      }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]: undefined | boolean | string | number | [any, undefined | boolean | InputValueType] | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
      [x: string]: ZeusArgsType;
    }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = '|';

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends new (...args: infer R) => WebSocket ? R : never;
export type chainOptions = [fetchOptions[0], fetchOptions[1] & { websocket?: websocketOptions }] | [fetchOptions[0]];
export type FetchFunction = (query: string, variables?: Record<string, unknown>) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<F extends [infer ARGS, any] ? ARGS : undefined>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super('');
    console.error(response);
  }
  toString() {
    return 'GraphQL Response Error';
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops ? typeof Ops[O] : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (mappedParts: string[], returns: ReturnTypesType): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === 'object') {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = ({ ops, returns }: { returns: ReturnTypesType; ops: Operations }) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string') {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith('scalar')) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map(([k, v]) =>
        ibb(k, k, v, [...p, purifyGraphQLKey(keyName || k)], [...pOriginals, purifyGraphQLKey(originalKey)], false),
      )
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) => k.replace(/\([^)]*\)/g, '').replace(/^[^:]*\:/g, '');

const mapPart = (p: string) => {
  const [isArg, isField] = p.split('<>');
  if (isField) {
    return {
      v: isField,
      __type: 'field',
    } as const;
  }
  return {
    v: isArg,
    __type: 'arg',
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (props: AllTypesPropsType, returns: ReturnTypesType, ops: Operations) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === 'enum' && mappedParts.length === 1) {
      return 'enum';
    }
    if (typeof propsP1 === 'string' && propsP1.startsWith('scalar.') && mappedParts.length === 1) {
      return propsP1;
    }
    if (typeof propsP1 === 'object') {
      if (mappedParts.length < 2) {
        return 'not';
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === 'string') {
        return rpp(
          `${propsP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
      if (typeof propsP2 === 'object') {
        if (mappedParts.length < 3) {
          return 'not';
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === 'arg') {
          return rpp(
            `${propsP3}${SEPARATOR}${mappedParts
              .slice(3)
              .map((mp) => mp.v)
              .join(SEPARATOR)}`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return 'not';
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === 'object') {
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
    }
  };
  const rpp = (path: string): 'enum' | 'not' | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return 'not';
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = '', root = true): string => {
    if (typeof a === 'string') {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a.replace(START_VAR_NAME, '$').split(GRAPHQL_TYPE_SEPARATOR);
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith('scalar.')) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split('.');
      const scalarKey = splittedScalar.join('.');
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(', ')}]`;
    }
    if (typeof a === 'string') {
      if (checkType === 'enum') {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === 'object') {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== 'undefined')
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(',\n');
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <X, T extends keyof ResolverInputTypes, Z extends keyof ResolverInputTypes[T]>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any] ? Input : any,
    source: any,
  ) => Z extends keyof ModelTypes[T] ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X : any,
) => fn as (args?: any, source?: any) => any;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<UnwrapPromise<ReturnType<T>>>;
export type ZeusHook<
  T extends (...args: any[]) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends 'scalar' & { name: infer T }
  ? T extends keyof SCLR
    ? SCLR[T]['decode'] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]['decode']>
      : unknown
    : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<SRC extends DeepAnify<DST>, DST, SCLR extends ScalarDefinition> = FlattenArray<SRC> extends
  | ZEUS_INTERFACES
  | ZEUS_UNIONS
  ? {
      [P in keyof SRC]: SRC[P] extends '__union' & infer R
        ? P extends keyof DST
          ? IsArray<R, '__typename' extends keyof DST ? DST[P] & { __typename: true } : DST[P], SCLR>
          : Record<string, unknown>
        : never;
    }[keyof DST] & {
      [P in keyof Omit<
        Pick<
          SRC,
          {
            [P in keyof DST]: SRC[P] extends '__union' & infer R ? never : P;
          }[keyof DST]
        >,
        '__typename'
      >]: IsPayLoad<DST[P]> extends BaseZeusResolver ? IsScalar<SRC[P], SCLR> : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
      [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<DST[P]> extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    };

export type MapType<SRC, DST, SCLR extends ScalarDefinition> = SRC extends DeepAnify<DST>
  ? IsInterfaced<SRC, DST, SCLR>
  : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<SRC, DST, SCLR extends ScalarDefinition = {}> = IsPayLoad<DST> extends { __alias: infer R }
  ? {
      [P in keyof R]: MapType<SRC, R[P], SCLR>[keyof MapType<SRC, R[P], SCLR>];
    } & MapType<SRC, Omit<IsPayLoad<DST>, '__alias'>, SCLR>
  : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (fn: (e: { data?: InputType<T, Z, SCLR>; code?: number; reason?: string; message?: string }) => void) => void;
  error: (fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<SELECTOR, NAME extends keyof GraphQLTypes, SCLR extends ScalarDefinition = {}> = InputType<
  GraphQLTypes[NAME],
  SELECTOR,
  SCLR
>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <T>(t: T | V) => T;

type BuiltInVariableTypes = {
  ['String']: string;
  ['Int']: number;
  ['Float']: number;
  ['ID']: unknown;
  ['Boolean']: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> = `${T}!` | T | `[${T}]` | `[${T}]!` | `[${T}!]` | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4>
        ? R4 extends VR<infer R5>
          ? R5
          : R4
        : R3
      : R2
    : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!`
  ? NonNullable<DecomposeType<R, Type>>
  : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> = T extends keyof ZEUS_VARIABLES
  ? ZEUS_VARIABLES[T]
  : T extends keyof BuiltInVariableTypes
  ? BuiltInVariableTypes[T]
  : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> = OptionalKeys<WithNullableKeys<T>> & WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  ' __zeus_name': Name;
  ' __zeus_type': T;
};

export type ExtractVariables<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
  ? ExtractVariables<Inputs> & ExtractVariables<Outputs>
  : Query extends string | number | boolean
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariables<Query[K]>> }[keyof Query]>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(name: Name, graphqlType: Type) => {
  return (START_VAR_NAME + name + GRAPHQL_TYPE_SEPARATOR + graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES = GraphQLTypes["Node"]
export type ScalarCoders = {
	Date?: ScalarResolver;
	DateTime?: ScalarResolver;
	Hex?: ScalarResolver;
	Json?: ScalarResolver;
	Long?: ScalarResolver;
	RGBAHue?: ScalarResolver;
	RGBATransparency?: ScalarResolver;
	RichTextAST?: ScalarResolver;
}
type ZEUS_UNIONS = GraphQLTypes["ScheduledOperationAffectedDocument"]

export type ValueTypes = {
    ["Aggregate"]: AliasType<{
	count?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Asset system model */
["Asset"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
	/** System Locale field */
	locale?:boolean | `@${string}`,
localizations?: [{	/** Potential locales that should be returned */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>,	/** Decides if the current locale should be included or not */
	includeCurrent: boolean | Variable<any, string>},ValueTypes["Asset"]],
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean | Variable<any, string>,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean | Variable<any, string>},ValueTypes["Asset"]],
	/** The mime type of the file */
	mimeType?:boolean | `@${string}`,
	/** The file size */
	size?:boolean | `@${string}`,
	/** The file width */
	width?:boolean | `@${string}`,
	/** The height of the file */
	height?:boolean | `@${string}`,
	/** The file name */
	fileName?:boolean | `@${string}`,
	/** The file handle */
	handle?:boolean | `@${string}`,
publishedAt?: [{	/** Variation of DateTime field to return, allows value from base document, current localization, or combined by returning the newer value of both */
	variation: ValueTypes["SystemDateTimeFieldVariation"] | Variable<any, string>},boolean | `@${string}`],
updatedAt?: [{	/** Variation of DateTime field to return, allows value from base document, current localization, or combined by returning the newer value of both */
	variation: ValueTypes["SystemDateTimeFieldVariation"] | Variable<any, string>},boolean | `@${string}`],
createdAt?: [{	/** Variation of DateTime field to return, allows value from base document, current localization, or combined by returning the newer value of both */
	variation: ValueTypes["SystemDateTimeFieldVariation"] | Variable<any, string>},boolean | `@${string}`],
	/** The unique identifier */
	id?:boolean | `@${string}`,
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
imageProject?: [{	where?: ValueTypes["ProjectWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ProjectOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `imageProject` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["Project"]],
imageSocial?: [{	where?: ValueTypes["SocialWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["SocialOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `imageSocial` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["Social"]],
imagePageMetadata?: [{	where?: ValueTypes["PageMetadataWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["PageMetadataOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `imagePageMetadata` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["PageMetadata"]],
iconSkill?: [{	where?: ValueTypes["SkillWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["SkillOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `iconSkill` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["Skill"]],
scheduledIn?: [{	where?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["ScheduledOperation"]],
history?: [{	limit: number | Variable<any, string>,	skip: number | Variable<any, string>,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ValueTypes["Stage"] | undefined | null | Variable<any, string>},ValueTypes["Version"]],
url?: [{	transformation?: ValueTypes["AssetTransformationInput"] | undefined | null | Variable<any, string>},boolean | `@${string}`],
		__typename?: boolean | `@${string}`
}>;
	["AssetConnectInput"]: {
	/** Document to connect */
	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ValueTypes["ConnectPositionInput"] | undefined | null | Variable<any, string>
};
	/** A connection to a list of items. */
["AssetConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ValueTypes["PageInfo"],
	/** A list of edges. */
	edges?:ValueTypes["AssetEdge"],
	aggregate?:ValueTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["AssetCreateInput"]: {
	mimeType?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	width?: number | undefined | null | Variable<any, string>,
	height?: number | undefined | null | Variable<any, string>,
	fileName: string | Variable<any, string>,
	handle: string | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	imageProject?: ValueTypes["ProjectCreateManyInlineInput"] | undefined | null | Variable<any, string>,
	imageSocial?: ValueTypes["SocialCreateManyInlineInput"] | undefined | null | Variable<any, string>,
	imagePageMetadata?: ValueTypes["PageMetadataCreateManyInlineInput"] | undefined | null | Variable<any, string>,
	iconSkill?: ValueTypes["SkillCreateManyInlineInput"] | undefined | null | Variable<any, string>,
	/** Inline mutations for managing document localizations excluding the default locale */
	localizations?: ValueTypes["AssetCreateLocalizationsInput"] | undefined | null | Variable<any, string>
};
	["AssetCreateLocalizationDataInput"]: {
	mimeType?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	width?: number | undefined | null | Variable<any, string>,
	height?: number | undefined | null | Variable<any, string>,
	fileName: string | Variable<any, string>,
	handle: string | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["AssetCreateLocalizationInput"]: {
	/** Localization input */
	data: ValueTypes["AssetCreateLocalizationDataInput"] | Variable<any, string>,
	locale: ValueTypes["Locale"] | Variable<any, string>
};
	["AssetCreateLocalizationsInput"]: {
	/** Create localizations for the newly-created document */
	create?: Array<ValueTypes["AssetCreateLocalizationInput"]> | undefined | null | Variable<any, string>
};
	["AssetCreateManyInlineInput"]: {
	/** Create and connect multiple existing Asset documents */
	create?: Array<ValueTypes["AssetCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing Asset documents */
	connect?: Array<ValueTypes["AssetWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["AssetCreateOneInlineInput"]: {
	/** Create and connect one Asset document */
	create?: ValueTypes["AssetCreateInput"] | undefined | null | Variable<any, string>,
	/** Connect one existing Asset document */
	connect?: ValueTypes["AssetWhereUniqueInput"] | undefined | null | Variable<any, string>
};
	/** An edge in a connection. */
["AssetEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ValueTypes["Asset"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["AssetManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["AssetWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["AssetWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["AssetWhereInput"]> | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	imageProject_every?: ValueTypes["ProjectWhereInput"] | undefined | null | Variable<any, string>,
	imageProject_some?: ValueTypes["ProjectWhereInput"] | undefined | null | Variable<any, string>,
	imageProject_none?: ValueTypes["ProjectWhereInput"] | undefined | null | Variable<any, string>,
	imageSocial_every?: ValueTypes["SocialWhereInput"] | undefined | null | Variable<any, string>,
	imageSocial_some?: ValueTypes["SocialWhereInput"] | undefined | null | Variable<any, string>,
	imageSocial_none?: ValueTypes["SocialWhereInput"] | undefined | null | Variable<any, string>,
	imagePageMetadata_every?: ValueTypes["PageMetadataWhereInput"] | undefined | null | Variable<any, string>,
	imagePageMetadata_some?: ValueTypes["PageMetadataWhereInput"] | undefined | null | Variable<any, string>,
	imagePageMetadata_none?: ValueTypes["PageMetadataWhereInput"] | undefined | null | Variable<any, string>,
	iconSkill_every?: ValueTypes["SkillWhereInput"] | undefined | null | Variable<any, string>,
	iconSkill_some?: ValueTypes["SkillWhereInput"] | undefined | null | Variable<any, string>,
	iconSkill_none?: ValueTypes["SkillWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	["AssetOrderByInput"]:AssetOrderByInput;
	/** Transformations for Assets */
["AssetTransformationInput"]: {
	image?: ValueTypes["ImageTransformationInput"] | undefined | null | Variable<any, string>,
	document?: ValueTypes["DocumentTransformationInput"] | undefined | null | Variable<any, string>,
	/** Pass true if you want to validate the passed transformation parameters */
	validateOptions?: boolean | undefined | null | Variable<any, string>
};
	["AssetUpdateInput"]: {
	mimeType?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	width?: number | undefined | null | Variable<any, string>,
	height?: number | undefined | null | Variable<any, string>,
	fileName?: string | undefined | null | Variable<any, string>,
	handle?: string | undefined | null | Variable<any, string>,
	imageProject?: ValueTypes["ProjectUpdateManyInlineInput"] | undefined | null | Variable<any, string>,
	imageSocial?: ValueTypes["SocialUpdateManyInlineInput"] | undefined | null | Variable<any, string>,
	imagePageMetadata?: ValueTypes["PageMetadataUpdateManyInlineInput"] | undefined | null | Variable<any, string>,
	iconSkill?: ValueTypes["SkillUpdateManyInlineInput"] | undefined | null | Variable<any, string>,
	/** Manage document localizations */
	localizations?: ValueTypes["AssetUpdateLocalizationsInput"] | undefined | null | Variable<any, string>
};
	["AssetUpdateLocalizationDataInput"]: {
	mimeType?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	width?: number | undefined | null | Variable<any, string>,
	height?: number | undefined | null | Variable<any, string>,
	fileName?: string | undefined | null | Variable<any, string>,
	handle?: string | undefined | null | Variable<any, string>
};
	["AssetUpdateLocalizationInput"]: {
	data: ValueTypes["AssetUpdateLocalizationDataInput"] | Variable<any, string>,
	locale: ValueTypes["Locale"] | Variable<any, string>
};
	["AssetUpdateLocalizationsInput"]: {
	/** Localizations to create */
	create?: Array<ValueTypes["AssetCreateLocalizationInput"]> | undefined | null | Variable<any, string>,
	/** Localizations to update */
	update?: Array<ValueTypes["AssetUpdateLocalizationInput"]> | undefined | null | Variable<any, string>,
	upsert?: Array<ValueTypes["AssetUpsertLocalizationInput"]> | undefined | null | Variable<any, string>,
	/** Localizations to delete */
	delete?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>
};
	["AssetUpdateManyInlineInput"]: {
	/** Create and connect multiple Asset documents */
	create?: Array<ValueTypes["AssetCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing Asset documents */
	connect?: Array<ValueTypes["AssetConnectInput"]> | undefined | null | Variable<any, string>,
	/** Override currently-connected documents with multiple existing Asset documents */
	set?: Array<ValueTypes["AssetWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Update multiple Asset documents */
	update?: Array<ValueTypes["AssetUpdateWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Upsert multiple Asset documents */
	upsert?: Array<ValueTypes["AssetUpsertWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Disconnect multiple Asset documents */
	disconnect?: Array<ValueTypes["AssetWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Delete multiple Asset documents */
	delete?: Array<ValueTypes["AssetWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["AssetUpdateManyInput"]: {
	mimeType?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	width?: number | undefined | null | Variable<any, string>,
	height?: number | undefined | null | Variable<any, string>,
	fileName?: string | undefined | null | Variable<any, string>,
	/** Optional updates to localizations */
	localizations?: ValueTypes["AssetUpdateManyLocalizationsInput"] | undefined | null | Variable<any, string>
};
	["AssetUpdateManyLocalizationDataInput"]: {
	mimeType?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	width?: number | undefined | null | Variable<any, string>,
	height?: number | undefined | null | Variable<any, string>,
	fileName?: string | undefined | null | Variable<any, string>
};
	["AssetUpdateManyLocalizationInput"]: {
	data: ValueTypes["AssetUpdateManyLocalizationDataInput"] | Variable<any, string>,
	locale: ValueTypes["Locale"] | Variable<any, string>
};
	["AssetUpdateManyLocalizationsInput"]: {
	/** Localizations to update */
	update?: Array<ValueTypes["AssetUpdateManyLocalizationInput"]> | undefined | null | Variable<any, string>
};
	["AssetUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ValueTypes["AssetWhereInput"] | Variable<any, string>,
	/** Update many input */
	data: ValueTypes["AssetUpdateManyInput"] | Variable<any, string>
};
	["AssetUpdateOneInlineInput"]: {
	/** Create and connect one Asset document */
	create?: ValueTypes["AssetCreateInput"] | undefined | null | Variable<any, string>,
	/** Update single Asset document */
	update?: ValueTypes["AssetUpdateWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Upsert single Asset document */
	upsert?: ValueTypes["AssetUpsertWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Connect existing Asset document */
	connect?: ValueTypes["AssetWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Disconnect currently connected Asset document */
	disconnect?: boolean | undefined | null | Variable<any, string>,
	/** Delete currently connected Asset document */
	delete?: boolean | undefined | null | Variable<any, string>
};
	["AssetUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,
	/** Document to update */
	data: ValueTypes["AssetUpdateInput"] | Variable<any, string>
};
	["AssetUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ValueTypes["AssetCreateInput"] | Variable<any, string>,
	/** Update document if it exists */
	update: ValueTypes["AssetUpdateInput"] | Variable<any, string>
};
	["AssetUpsertLocalizationInput"]: {
	update: ValueTypes["AssetUpdateLocalizationDataInput"] | Variable<any, string>,
	create: ValueTypes["AssetCreateLocalizationDataInput"] | Variable<any, string>,
	locale: ValueTypes["Locale"] | Variable<any, string>
};
	["AssetUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,
	/** Upsert data */
	data: ValueTypes["AssetUpsertInput"] | Variable<any, string>
};
	/** Identifies documents */
["AssetWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["AssetWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["AssetWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["AssetWhereInput"]> | undefined | null | Variable<any, string>,
	mimeType?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	mimeType_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	mimeType_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	mimeType_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	mimeType_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	mimeType_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	mimeType_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	mimeType_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	mimeType_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	mimeType_not_ends_with?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	size_not?: number | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	size_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	size_not_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	size_lt?: number | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	size_lte?: number | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	size_gt?: number | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	size_gte?: number | undefined | null | Variable<any, string>,
	width?: number | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	width_not?: number | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	width_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	width_not_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	width_lt?: number | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	width_lte?: number | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	width_gt?: number | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	width_gte?: number | undefined | null | Variable<any, string>,
	height?: number | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	height_not?: number | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	height_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	height_not_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	height_lt?: number | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	height_lte?: number | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	height_gt?: number | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	height_gte?: number | undefined | null | Variable<any, string>,
	fileName?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	fileName_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	fileName_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	fileName_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	fileName_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	fileName_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	fileName_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	fileName_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	fileName_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	fileName_not_ends_with?: string | undefined | null | Variable<any, string>,
	handle?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	handle_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	handle_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	handle_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	handle_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	handle_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	handle_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	handle_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	handle_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	handle_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	imageProject_every?: ValueTypes["ProjectWhereInput"] | undefined | null | Variable<any, string>,
	imageProject_some?: ValueTypes["ProjectWhereInput"] | undefined | null | Variable<any, string>,
	imageProject_none?: ValueTypes["ProjectWhereInput"] | undefined | null | Variable<any, string>,
	imageSocial_every?: ValueTypes["SocialWhereInput"] | undefined | null | Variable<any, string>,
	imageSocial_some?: ValueTypes["SocialWhereInput"] | undefined | null | Variable<any, string>,
	imageSocial_none?: ValueTypes["SocialWhereInput"] | undefined | null | Variable<any, string>,
	imagePageMetadata_every?: ValueTypes["PageMetadataWhereInput"] | undefined | null | Variable<any, string>,
	imagePageMetadata_some?: ValueTypes["PageMetadataWhereInput"] | undefined | null | Variable<any, string>,
	imagePageMetadata_none?: ValueTypes["PageMetadataWhereInput"] | undefined | null | Variable<any, string>,
	iconSkill_every?: ValueTypes["SkillWhereInput"] | undefined | null | Variable<any, string>,
	iconSkill_some?: ValueTypes["SkillWhereInput"] | undefined | null | Variable<any, string>,
	iconSkill_none?: ValueTypes["SkillWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	/** References Asset record uniquely */
["AssetWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>
};
	["BatchPayload"]: AliasType<{
	/** The number of nodes that have been affected by the Batch operation. */
	count?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Representing a color value comprising of HEX, RGBA and css color values */
["Color"]: AliasType<{
	hex?:boolean | `@${string}`,
	rgba?:ValueTypes["RGBA"],
	css?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Accepts either HEX or RGBA color value. At least one of hex or rgba value should be passed. If both are passed RGBA is used. */
["ColorInput"]: {
	hex?: ValueTypes["Hex"] | undefined | null | Variable<any, string>,
	rgba?: ValueTypes["RGBAInput"] | undefined | null | Variable<any, string>
};
	["ConnectPositionInput"]: {
	/** Connect document after specified document */
	after?: string | undefined | null | Variable<any, string>,
	/** Connect document before specified document */
	before?: string | undefined | null | Variable<any, string>,
	/** Connect document at first position */
	start?: boolean | undefined | null | Variable<any, string>,
	/** Connect document at last position */
	end?: boolean | undefined | null | Variable<any, string>
};
	/** A date string, such as 2007-12-03 (YYYY-MM-DD), compliant with ISO 8601 standard for representation of dates using the Gregorian calendar. */
["Date"]:unknown;
	/** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the date-timeformat outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representationof dates and times using the Gregorian calendar. */
["DateTime"]:unknown;
	["DocumentFileTypes"]:DocumentFileTypes;
	["DocumentOutputInput"]: {
	/** Transforms a document into a desired file type.
See this matrix for format support:

PDF:	jpg, odp, ods, odt, png, svg, txt, and webp
DOC:	docx, html, jpg, odt, pdf, png, svg, txt, and webp
DOCX:	doc, html, jpg, odt, pdf, png, svg, txt, and webp
ODT:	doc, docx, html, jpg, pdf, png, svg, txt, and webp
XLS:	jpg, pdf, ods, png, svg, xlsx, and webp
XLSX:	jpg, pdf, ods, png, svg, xls, and webp
ODS:	jpg, pdf, png, xls, svg, xlsx, and webp
PPT:	jpg, odp, pdf, png, svg, pptx, and webp
PPTX:	jpg, odp, pdf, png, svg, ppt, and webp
ODP:	jpg, pdf, png, ppt, svg, pptx, and webp
BMP:	jpg, odp, ods, odt, pdf, png, svg, and webp
GIF:	jpg, odp, ods, odt, pdf, png, svg, and webp
JPG:	jpg, odp, ods, odt, pdf, png, svg, and webp
PNG:	jpg, odp, ods, odt, pdf, png, svg, and webp
WEBP:	jpg, odp, ods, odt, pdf, png, svg, and webp
TIFF:	jpg, odp, ods, odt, pdf, png, svg, and webp
AI:	    jpg, odp, ods, odt, pdf, png, svg, and webp
PSD:	jpg, odp, ods, odt, pdf, png, svg, and webp
SVG:	jpg, odp, ods, odt, pdf, png, and webp
HTML:	jpg, odt, pdf, svg, txt, and webp
TXT:	jpg, html, odt, pdf, svg, and webp */
	format?: ValueTypes["DocumentFileTypes"] | undefined | null | Variable<any, string>
};
	/** Transformations for Documents */
["DocumentTransformationInput"]: {
	/** Changes the output for the file. */
	output?: ValueTypes["DocumentOutputInput"] | undefined | null | Variable<any, string>
};
	["DocumentVersion"]: AliasType<{
	id?:boolean | `@${string}`,
	stage?:boolean | `@${string}`,
	revision?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	data?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Hex"]:unknown;
	["ImageFit"]:ImageFit;
	["ImageResizeInput"]: {
	/** The width in pixels to resize the image to. The value must be an integer from 1 to 10000. */
	width?: number | undefined | null | Variable<any, string>,
	/** The height in pixels to resize the image to. The value must be an integer from 1 to 10000. */
	height?: number | undefined | null | Variable<any, string>,
	/** The default value for the fit parameter is fit:clip. */
	fit?: ValueTypes["ImageFit"] | undefined | null | Variable<any, string>
};
	/** Transformations for Images */
["ImageTransformationInput"]: {
	/** Resizes the image */
	resize?: ValueTypes["ImageResizeInput"] | undefined | null | Variable<any, string>
};
	/** Raw JSON value */
["Json"]:unknown;
	/** Locale system enumeration */
["Locale"]:Locale;
	/** Representing a geolocation point with latitude and longitude */
["Location"]: AliasType<{
	latitude?:boolean | `@${string}`,
	longitude?:boolean | `@${string}`,
distance?: [{	from: ValueTypes["LocationInput"] | Variable<any, string>},boolean | `@${string}`],
		__typename?: boolean | `@${string}`
}>;
	/** Input for a geolocation point with latitude and longitude */
["LocationInput"]: {
	latitude: number | Variable<any, string>,
	longitude: number | Variable<any, string>
};
	/** The Long scalar type represents non-fractional signed whole numeric values. Long can represent values between -(2^63) and 2^63 - 1. */
["Long"]:unknown;
	["Mutation"]: AliasType<{
createAsset?: [{	data: ValueTypes["AssetCreateInput"] | Variable<any, string>},ValueTypes["Asset"]],
updateAsset?: [{	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,	data: ValueTypes["AssetUpdateInput"] | Variable<any, string>},ValueTypes["Asset"]],
deleteAsset?: [{	/** Document to delete */
	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>},ValueTypes["Asset"]],
upsertAsset?: [{	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,	upsert: ValueTypes["AssetUpsertInput"] | Variable<any, string>},ValueTypes["Asset"]],
publishAsset?: [{	/** Document to publish */
	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,	/** Optional localizations to publish */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>,	/** Whether to publish the base document */
	publishBase?: boolean | undefined | null | Variable<any, string>,	/** Whether to include the default locale when publishBase is set */
	withDefaultLocale?: boolean | undefined | null | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["Asset"]],
unpublishAsset?: [{	/** Document to unpublish */
	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Optional locales to unpublish. Unpublishing the default locale will completely remove the document from the selected stages */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>,	/** Unpublish complete document including default localization and relations from stages. Can be disabled. */
	unpublishBase?: boolean | undefined | null | Variable<any, string>},ValueTypes["Asset"]],
updateManyAssetsConnection?: [{	/** Documents to apply update on */
	where?: ValueTypes["AssetManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["AssetUpdateManyInput"] | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["AssetConnection"]],
deleteManyAssetsConnection?: [{	/** Documents to delete */
	where?: ValueTypes["AssetManyWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["AssetConnection"]],
publishManyAssetsConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["AssetManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	from?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	/** Document localizations to publish */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>,	/** Whether to publish the base document */
	publishBase?: boolean | undefined | null | Variable<any, string>,	/** Whether to include the default locale when publishBase is true */
	withDefaultLocale?: boolean | undefined | null | Variable<any, string>},ValueTypes["AssetConnection"]],
unpublishManyAssetsConnection?: [{	/** Identifies documents in draft stage */
	where?: ValueTypes["AssetManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	stage?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	/** Locales to unpublish */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>,	/** Whether to unpublish the base document and default localization */
	unpublishBase?: boolean | undefined | null | Variable<any, string>},ValueTypes["AssetConnection"]],
updateManyAssets?: [{	/** Documents to apply update on */
	where?: ValueTypes["AssetManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["AssetUpdateManyInput"] | Variable<any, string>},ValueTypes["BatchPayload"]],
deleteManyAssets?: [{	/** Documents to delete */
	where?: ValueTypes["AssetManyWhereInput"] | undefined | null | Variable<any, string>},ValueTypes["BatchPayload"]],
publishManyAssets?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["AssetManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Document localizations to publish */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>,	/** Whether to publish the base document */
	publishBase?: boolean | undefined | null | Variable<any, string>,	/** Whether to include the default locale when publishBase is true */
	withDefaultLocale?: boolean | undefined | null | Variable<any, string>},ValueTypes["BatchPayload"]],
unpublishManyAssets?: [{	/** Identifies documents in each stage */
	where?: ValueTypes["AssetManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Locales to unpublish */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>,	/** Whether to unpublish the base document and default localization */
	unpublishBase?: boolean | undefined | null | Variable<any, string>},ValueTypes["BatchPayload"]],
schedulePublishAsset?: [{	/** Document to publish */
	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,	/** Optional localizations to publish */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>,	/** Whether to publish the base document */
	publishBase?: boolean | undefined | null | Variable<any, string>,	/** Whether to include the default locale when publishBase is set */
	withDefaultLocale?: boolean | undefined | null | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>},ValueTypes["Asset"]],
scheduleUnpublishAsset?: [{	/** Document to unpublish */
	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>,	/** Optional locales to unpublish. Unpublishing the default locale will completely remove the document from the selected stages */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>,	/** Unpublish complete document including default localization and relations from stages. Can be disabled. */
	unpublishBase?: boolean | undefined | null | Variable<any, string>},ValueTypes["Asset"]],
deleteScheduledOperation?: [{	/** Document to delete */
	where: ValueTypes["ScheduledOperationWhereUniqueInput"] | Variable<any, string>},ValueTypes["ScheduledOperation"]],
createScheduledRelease?: [{	data: ValueTypes["ScheduledReleaseCreateInput"] | Variable<any, string>},ValueTypes["ScheduledRelease"]],
updateScheduledRelease?: [{	where: ValueTypes["ScheduledReleaseWhereUniqueInput"] | Variable<any, string>,	data: ValueTypes["ScheduledReleaseUpdateInput"] | Variable<any, string>},ValueTypes["ScheduledRelease"]],
deleteScheduledRelease?: [{	/** Document to delete */
	where: ValueTypes["ScheduledReleaseWhereUniqueInput"] | Variable<any, string>},ValueTypes["ScheduledRelease"]],
createProject?: [{	data: ValueTypes["ProjectCreateInput"] | Variable<any, string>},ValueTypes["Project"]],
updateProject?: [{	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,	data: ValueTypes["ProjectUpdateInput"] | Variable<any, string>},ValueTypes["Project"]],
deleteProject?: [{	/** Document to delete */
	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>},ValueTypes["Project"]],
upsertProject?: [{	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,	upsert: ValueTypes["ProjectUpsertInput"] | Variable<any, string>},ValueTypes["Project"]],
publishProject?: [{	/** Document to publish */
	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["Project"]],
unpublishProject?: [{	/** Document to unpublish */
	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["Project"]],
updateManyProjectsConnection?: [{	/** Documents to apply update on */
	where?: ValueTypes["ProjectManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["ProjectUpdateManyInput"] | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["ProjectConnection"]],
deleteManyProjectsConnection?: [{	/** Documents to delete */
	where?: ValueTypes["ProjectManyWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["ProjectConnection"]],
publishManyProjectsConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["ProjectManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	from?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["ProjectConnection"]],
unpublishManyProjectsConnection?: [{	/** Identifies documents in draft stage */
	where?: ValueTypes["ProjectManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	stage?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["ProjectConnection"]],
updateManyProjects?: [{	/** Documents to apply update on */
	where?: ValueTypes["ProjectManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["ProjectUpdateManyInput"] | Variable<any, string>},ValueTypes["BatchPayload"]],
deleteManyProjects?: [{	/** Documents to delete */
	where?: ValueTypes["ProjectManyWhereInput"] | undefined | null | Variable<any, string>},ValueTypes["BatchPayload"]],
publishManyProjects?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["ProjectManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["BatchPayload"]],
unpublishManyProjects?: [{	/** Identifies documents in each stage */
	where?: ValueTypes["ProjectManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["BatchPayload"]],
schedulePublishProject?: [{	/** Document to publish */
	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>},ValueTypes["Project"]],
scheduleUnpublishProject?: [{	/** Document to unpublish */
	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>},ValueTypes["Project"]],
createSocial?: [{	data: ValueTypes["SocialCreateInput"] | Variable<any, string>},ValueTypes["Social"]],
updateSocial?: [{	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,	data: ValueTypes["SocialUpdateInput"] | Variable<any, string>},ValueTypes["Social"]],
deleteSocial?: [{	/** Document to delete */
	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>},ValueTypes["Social"]],
upsertSocial?: [{	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,	upsert: ValueTypes["SocialUpsertInput"] | Variable<any, string>},ValueTypes["Social"]],
publishSocial?: [{	/** Document to publish */
	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["Social"]],
unpublishSocial?: [{	/** Document to unpublish */
	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["Social"]],
updateManySocialsConnection?: [{	/** Documents to apply update on */
	where?: ValueTypes["SocialManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["SocialUpdateManyInput"] | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["SocialConnection"]],
deleteManySocialsConnection?: [{	/** Documents to delete */
	where?: ValueTypes["SocialManyWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["SocialConnection"]],
publishManySocialsConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["SocialManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	from?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["SocialConnection"]],
unpublishManySocialsConnection?: [{	/** Identifies documents in draft stage */
	where?: ValueTypes["SocialManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	stage?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["SocialConnection"]],
updateManySocials?: [{	/** Documents to apply update on */
	where?: ValueTypes["SocialManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["SocialUpdateManyInput"] | Variable<any, string>},ValueTypes["BatchPayload"]],
deleteManySocials?: [{	/** Documents to delete */
	where?: ValueTypes["SocialManyWhereInput"] | undefined | null | Variable<any, string>},ValueTypes["BatchPayload"]],
publishManySocials?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["SocialManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["BatchPayload"]],
unpublishManySocials?: [{	/** Identifies documents in each stage */
	where?: ValueTypes["SocialManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["BatchPayload"]],
schedulePublishSocial?: [{	/** Document to publish */
	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>},ValueTypes["Social"]],
scheduleUnpublishSocial?: [{	/** Document to unpublish */
	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>},ValueTypes["Social"]],
createPageMetadata?: [{	data: ValueTypes["PageMetadataCreateInput"] | Variable<any, string>},ValueTypes["PageMetadata"]],
updatePageMetadata?: [{	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,	data: ValueTypes["PageMetadataUpdateInput"] | Variable<any, string>},ValueTypes["PageMetadata"]],
deletePageMetadata?: [{	/** Document to delete */
	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>},ValueTypes["PageMetadata"]],
upsertPageMetadata?: [{	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,	upsert: ValueTypes["PageMetadataUpsertInput"] | Variable<any, string>},ValueTypes["PageMetadata"]],
publishPageMetadata?: [{	/** Document to publish */
	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["PageMetadata"]],
unpublishPageMetadata?: [{	/** Document to unpublish */
	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["PageMetadata"]],
updateManyPagesMetadataConnection?: [{	/** Documents to apply update on */
	where?: ValueTypes["PageMetadataManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["PageMetadataUpdateManyInput"] | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["PageMetadataConnection"]],
deleteManyPagesMetadataConnection?: [{	/** Documents to delete */
	where?: ValueTypes["PageMetadataManyWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["PageMetadataConnection"]],
publishManyPagesMetadataConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["PageMetadataManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	from?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["PageMetadataConnection"]],
unpublishManyPagesMetadataConnection?: [{	/** Identifies documents in draft stage */
	where?: ValueTypes["PageMetadataManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	stage?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["PageMetadataConnection"]],
updateManyPagesMetadata?: [{	/** Documents to apply update on */
	where?: ValueTypes["PageMetadataManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["PageMetadataUpdateManyInput"] | Variable<any, string>},ValueTypes["BatchPayload"]],
deleteManyPagesMetadata?: [{	/** Documents to delete */
	where?: ValueTypes["PageMetadataManyWhereInput"] | undefined | null | Variable<any, string>},ValueTypes["BatchPayload"]],
publishManyPagesMetadata?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["PageMetadataManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["BatchPayload"]],
unpublishManyPagesMetadata?: [{	/** Identifies documents in each stage */
	where?: ValueTypes["PageMetadataManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["BatchPayload"]],
schedulePublishPageMetadata?: [{	/** Document to publish */
	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>},ValueTypes["PageMetadata"]],
scheduleUnpublishPageMetadata?: [{	/** Document to unpublish */
	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>},ValueTypes["PageMetadata"]],
createSkill?: [{	data: ValueTypes["SkillCreateInput"] | Variable<any, string>},ValueTypes["Skill"]],
updateSkill?: [{	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,	data: ValueTypes["SkillUpdateInput"] | Variable<any, string>},ValueTypes["Skill"]],
deleteSkill?: [{	/** Document to delete */
	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>},ValueTypes["Skill"]],
upsertSkill?: [{	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,	upsert: ValueTypes["SkillUpsertInput"] | Variable<any, string>},ValueTypes["Skill"]],
publishSkill?: [{	/** Document to publish */
	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["Skill"]],
unpublishSkill?: [{	/** Document to unpublish */
	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["Skill"]],
updateManySkillsConnection?: [{	/** Documents to apply update on */
	where?: ValueTypes["SkillManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["SkillUpdateManyInput"] | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["SkillConnection"]],
deleteManySkillsConnection?: [{	/** Documents to delete */
	where?: ValueTypes["SkillManyWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["SkillConnection"]],
publishManySkillsConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["SkillManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	from?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["SkillConnection"]],
unpublishManySkillsConnection?: [{	/** Identifies documents in draft stage */
	where?: ValueTypes["SkillManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stage to find matching documents in */
	stage?: ValueTypes["Stage"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>},ValueTypes["SkillConnection"]],
updateManySkills?: [{	/** Documents to apply update on */
	where?: ValueTypes["SkillManyWhereInput"] | undefined | null | Variable<any, string>,	/** Updates to document content */
	data: ValueTypes["SkillUpdateManyInput"] | Variable<any, string>},ValueTypes["BatchPayload"]],
deleteManySkills?: [{	/** Documents to delete */
	where?: ValueTypes["SkillManyWhereInput"] | undefined | null | Variable<any, string>},ValueTypes["BatchPayload"]],
publishManySkills?: [{	/** Identifies documents in each stage to be published */
	where?: ValueTypes["SkillManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to publish documents to */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["BatchPayload"]],
unpublishManySkills?: [{	/** Identifies documents in each stage */
	where?: ValueTypes["SkillManyWhereInput"] | undefined | null | Variable<any, string>,	/** Stages to unpublish documents from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>},ValueTypes["BatchPayload"]],
schedulePublishSkill?: [{	/** Document to publish */
	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,	/** Publishing target stage */
	to: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>},ValueTypes["Skill"]],
scheduleUnpublishSkill?: [{	/** Document to unpublish */
	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,	/** Stages to unpublish document from */
	from: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null | Variable<any, string>},ValueTypes["Skill"]],
		__typename?: boolean | `@${string}`
}>;
	/** An object with an ID */
["Node"]:AliasType<{
		/** The id of the object. */
	id?:boolean | `@${string}`,
	/** The Stage of an object */
	stage?:boolean | `@${string}`;
		['...on Asset']?: Omit<ValueTypes["Asset"],keyof ValueTypes["Node"]>;
		['...on PageMetadata']?: Omit<ValueTypes["PageMetadata"],keyof ValueTypes["Node"]>;
		['...on Project']?: Omit<ValueTypes["Project"],keyof ValueTypes["Node"]>;
		['...on ScheduledOperation']?: Omit<ValueTypes["ScheduledOperation"],keyof ValueTypes["Node"]>;
		['...on ScheduledRelease']?: Omit<ValueTypes["ScheduledRelease"],keyof ValueTypes["Node"]>;
		['...on Skill']?: Omit<ValueTypes["Skill"],keyof ValueTypes["Node"]>;
		['...on Social']?: Omit<ValueTypes["Social"],keyof ValueTypes["Node"]>;
		['...on User']?: Omit<ValueTypes["User"],keyof ValueTypes["Node"]>;
		__typename?: boolean | `@${string}`
}>;
	/** Information about pagination in a connection. */
["PageInfo"]: AliasType<{
	/** When paginating forwards, are there more items? */
	hasNextPage?:boolean | `@${string}`,
	/** When paginating backwards, are there more items? */
	hasPreviousPage?:boolean | `@${string}`,
	/** When paginating backwards, the cursor to continue. */
	startCursor?:boolean | `@${string}`,
	/** When paginating forwards, the cursor to continue. */
	endCursor?:boolean | `@${string}`,
	/** Number of items in the current page. */
	pageSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Page Metadata */
["PageMetadata"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean | Variable<any, string>,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean | Variable<any, string>},ValueTypes["PageMetadata"]],
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	/** Page title */
	title?:boolean | `@${string}`,
	/** Page content summary */
	summary?:boolean | `@${string}`,
	/** Page slug */
	slug?:boolean | `@${string}`,
	/** Page number */
	pageNumber?:boolean | `@${string}`,
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
image?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `image` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["Asset"]],
scheduledIn?: [{	where?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["ScheduledOperation"]],
history?: [{	limit: number | Variable<any, string>,	skip: number | Variable<any, string>,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ValueTypes["Stage"] | undefined | null | Variable<any, string>},ValueTypes["Version"]],
		__typename?: boolean | `@${string}`
}>;
	["PageMetadataConnectInput"]: {
	/** Document to connect */
	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ValueTypes["ConnectPositionInput"] | undefined | null | Variable<any, string>
};
	/** A connection to a list of items. */
["PageMetadataConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ValueTypes["PageInfo"],
	/** A list of edges. */
	edges?:ValueTypes["PageMetadataEdge"],
	aggregate?:ValueTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["PageMetadataCreateInput"]: {
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	title: string | Variable<any, string>,
	summary: string | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	pageNumber: number | Variable<any, string>,
	image?: ValueTypes["AssetCreateOneInlineInput"] | undefined | null | Variable<any, string>
};
	["PageMetadataCreateManyInlineInput"]: {
	/** Create and connect multiple existing PageMetadata documents */
	create?: Array<ValueTypes["PageMetadataCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing PageMetadata documents */
	connect?: Array<ValueTypes["PageMetadataWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["PageMetadataCreateOneInlineInput"]: {
	/** Create and connect one PageMetadata document */
	create?: ValueTypes["PageMetadataCreateInput"] | undefined | null | Variable<any, string>,
	/** Connect one existing PageMetadata document */
	connect?: ValueTypes["PageMetadataWhereUniqueInput"] | undefined | null | Variable<any, string>
};
	/** An edge in a connection. */
["PageMetadataEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ValueTypes["PageMetadata"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["PageMetadataManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["PageMetadataWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["PageMetadataWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["PageMetadataWhereInput"]> | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	title?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	title_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	title_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined | null | Variable<any, string>,
	summary?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	summary_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	summary_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	summary_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	summary_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	summary_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	summary_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	summary_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	summary_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	summary_not_ends_with?: string | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	slug_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined | null | Variable<any, string>,
	pageNumber?: number | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	pageNumber_not?: number | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	pageNumber_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	pageNumber_not_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	pageNumber_lt?: number | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	pageNumber_lte?: number | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	pageNumber_gt?: number | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	pageNumber_gte?: number | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	image?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	["PageMetadataOrderByInput"]:PageMetadataOrderByInput;
	["PageMetadataUpdateInput"]: {
	title?: string | undefined | null | Variable<any, string>,
	summary?: string | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	pageNumber?: number | undefined | null | Variable<any, string>,
	image?: ValueTypes["AssetUpdateOneInlineInput"] | undefined | null | Variable<any, string>
};
	["PageMetadataUpdateManyInlineInput"]: {
	/** Create and connect multiple PageMetadata documents */
	create?: Array<ValueTypes["PageMetadataCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing PageMetadata documents */
	connect?: Array<ValueTypes["PageMetadataConnectInput"]> | undefined | null | Variable<any, string>,
	/** Override currently-connected documents with multiple existing PageMetadata documents */
	set?: Array<ValueTypes["PageMetadataWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Update multiple PageMetadata documents */
	update?: Array<ValueTypes["PageMetadataUpdateWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Upsert multiple PageMetadata documents */
	upsert?: Array<ValueTypes["PageMetadataUpsertWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Disconnect multiple PageMetadata documents */
	disconnect?: Array<ValueTypes["PageMetadataWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Delete multiple PageMetadata documents */
	delete?: Array<ValueTypes["PageMetadataWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["PageMetadataUpdateManyInput"]: {
	summary?: string | undefined | null | Variable<any, string>,
	pageNumber?: number | undefined | null | Variable<any, string>
};
	["PageMetadataUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ValueTypes["PageMetadataWhereInput"] | Variable<any, string>,
	/** Update many input */
	data: ValueTypes["PageMetadataUpdateManyInput"] | Variable<any, string>
};
	["PageMetadataUpdateOneInlineInput"]: {
	/** Create and connect one PageMetadata document */
	create?: ValueTypes["PageMetadataCreateInput"] | undefined | null | Variable<any, string>,
	/** Update single PageMetadata document */
	update?: ValueTypes["PageMetadataUpdateWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Upsert single PageMetadata document */
	upsert?: ValueTypes["PageMetadataUpsertWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Connect existing PageMetadata document */
	connect?: ValueTypes["PageMetadataWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Disconnect currently connected PageMetadata document */
	disconnect?: boolean | undefined | null | Variable<any, string>,
	/** Delete currently connected PageMetadata document */
	delete?: boolean | undefined | null | Variable<any, string>
};
	["PageMetadataUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,
	/** Document to update */
	data: ValueTypes["PageMetadataUpdateInput"] | Variable<any, string>
};
	["PageMetadataUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ValueTypes["PageMetadataCreateInput"] | Variable<any, string>,
	/** Update document if it exists */
	update: ValueTypes["PageMetadataUpdateInput"] | Variable<any, string>
};
	["PageMetadataUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,
	/** Upsert data */
	data: ValueTypes["PageMetadataUpsertInput"] | Variable<any, string>
};
	/** Identifies documents */
["PageMetadataWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["PageMetadataWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["PageMetadataWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["PageMetadataWhereInput"]> | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	title?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	title_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	title_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined | null | Variable<any, string>,
	summary?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	summary_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	summary_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	summary_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	summary_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	summary_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	summary_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	summary_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	summary_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	summary_not_ends_with?: string | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	slug_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined | null | Variable<any, string>,
	pageNumber?: number | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	pageNumber_not?: number | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	pageNumber_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	pageNumber_not_in?: Array<number | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	pageNumber_lt?: number | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	pageNumber_lte?: number | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	pageNumber_gt?: number | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	pageNumber_gte?: number | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	image?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	/** References PageMetadata record uniquely */
["PageMetadataWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>,
	title?: string | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>
};
	["Project"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean | Variable<any, string>,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean | Variable<any, string>},ValueTypes["Project"]],
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	slug?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	tags?:boolean | `@${string}`,
	demo?:boolean | `@${string}`,
	sourceCode?:boolean | `@${string}`,
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
image?: [{	where?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["AssetOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `image` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["Asset"]],
scheduledIn?: [{	where?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["ScheduledOperation"]],
history?: [{	limit: number | Variable<any, string>,	skip: number | Variable<any, string>,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ValueTypes["Stage"] | undefined | null | Variable<any, string>},ValueTypes["Version"]],
		__typename?: boolean | `@${string}`
}>;
	["ProjectConnectInput"]: {
	/** Document to connect */
	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ValueTypes["ConnectPositionInput"] | undefined | null | Variable<any, string>
};
	/** A connection to a list of items. */
["ProjectConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ValueTypes["PageInfo"],
	/** A list of edges. */
	edges?:ValueTypes["ProjectEdge"],
	aggregate?:ValueTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["ProjectCreateInput"]: {
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	description: string | Variable<any, string>,
	tags?: Array<string> | undefined | null | Variable<any, string>,
	demo?: string | undefined | null | Variable<any, string>,
	sourceCode?: string | undefined | null | Variable<any, string>,
	image: ValueTypes["AssetCreateManyInlineInput"] | Variable<any, string>
};
	["ProjectCreateManyInlineInput"]: {
	/** Create and connect multiple existing Project documents */
	create?: Array<ValueTypes["ProjectCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing Project documents */
	connect?: Array<ValueTypes["ProjectWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["ProjectCreateOneInlineInput"]: {
	/** Create and connect one Project document */
	create?: ValueTypes["ProjectCreateInput"] | undefined | null | Variable<any, string>,
	/** Connect one existing Project document */
	connect?: ValueTypes["ProjectWhereUniqueInput"] | undefined | null | Variable<any, string>
};
	/** An edge in a connection. */
["ProjectEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ValueTypes["Project"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["ProjectManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["ProjectWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["ProjectWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["ProjectWhereInput"]> | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	name_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	slug_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	description_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null | Variable<any, string>,
	/** Matches if the field array contains *all* items provided to the filter and order does match */
	tags?: Array<string> | undefined | null | Variable<any, string>,
	/** Matches if the field array does not contains *all* items provided to the filter or order does not match */
	tags_not?: Array<string> | undefined | null | Variable<any, string>,
	/** Matches if the field array contains *all* items provided to the filter */
	tags_contains_all?: Array<string> | undefined | null | Variable<any, string>,
	/** Matches if the field array contains at least one item provided to the filter */
	tags_contains_some?: Array<string> | undefined | null | Variable<any, string>,
	/** Matches if the field array does not contain any of the items provided to the filter */
	tags_contains_none?: Array<string> | undefined | null | Variable<any, string>,
	demo?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	demo_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	demo_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	demo_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	demo_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	demo_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	demo_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	demo_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	demo_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	demo_not_ends_with?: string | undefined | null | Variable<any, string>,
	sourceCode?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	sourceCode_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	sourceCode_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	sourceCode_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	sourceCode_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	sourceCode_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	sourceCode_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	sourceCode_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	sourceCode_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	sourceCode_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	image_every?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	image_some?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	image_none?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	["ProjectOrderByInput"]:ProjectOrderByInput;
	["ProjectUpdateInput"]: {
	name?: string | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	tags?: Array<string> | undefined | null | Variable<any, string>,
	demo?: string | undefined | null | Variable<any, string>,
	sourceCode?: string | undefined | null | Variable<any, string>,
	image?: ValueTypes["AssetUpdateManyInlineInput"] | undefined | null | Variable<any, string>
};
	["ProjectUpdateManyInlineInput"]: {
	/** Create and connect multiple Project documents */
	create?: Array<ValueTypes["ProjectCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing Project documents */
	connect?: Array<ValueTypes["ProjectConnectInput"]> | undefined | null | Variable<any, string>,
	/** Override currently-connected documents with multiple existing Project documents */
	set?: Array<ValueTypes["ProjectWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Update multiple Project documents */
	update?: Array<ValueTypes["ProjectUpdateWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Upsert multiple Project documents */
	upsert?: Array<ValueTypes["ProjectUpsertWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Disconnect multiple Project documents */
	disconnect?: Array<ValueTypes["ProjectWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Delete multiple Project documents */
	delete?: Array<ValueTypes["ProjectWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["ProjectUpdateManyInput"]: {
	description?: string | undefined | null | Variable<any, string>,
	tags?: Array<string> | undefined | null | Variable<any, string>,
	demo?: string | undefined | null | Variable<any, string>,
	sourceCode?: string | undefined | null | Variable<any, string>
};
	["ProjectUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ValueTypes["ProjectWhereInput"] | Variable<any, string>,
	/** Update many input */
	data: ValueTypes["ProjectUpdateManyInput"] | Variable<any, string>
};
	["ProjectUpdateOneInlineInput"]: {
	/** Create and connect one Project document */
	create?: ValueTypes["ProjectCreateInput"] | undefined | null | Variable<any, string>,
	/** Update single Project document */
	update?: ValueTypes["ProjectUpdateWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Upsert single Project document */
	upsert?: ValueTypes["ProjectUpsertWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Connect existing Project document */
	connect?: ValueTypes["ProjectWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Disconnect currently connected Project document */
	disconnect?: boolean | undefined | null | Variable<any, string>,
	/** Delete currently connected Project document */
	delete?: boolean | undefined | null | Variable<any, string>
};
	["ProjectUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,
	/** Document to update */
	data: ValueTypes["ProjectUpdateInput"] | Variable<any, string>
};
	["ProjectUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ValueTypes["ProjectCreateInput"] | Variable<any, string>,
	/** Update document if it exists */
	update: ValueTypes["ProjectUpdateInput"] | Variable<any, string>
};
	["ProjectUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,
	/** Upsert data */
	data: ValueTypes["ProjectUpsertInput"] | Variable<any, string>
};
	/** Identifies documents */
["ProjectWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["ProjectWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["ProjectWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["ProjectWhereInput"]> | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	name_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	slug_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	description_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null | Variable<any, string>,
	/** Matches if the field array contains *all* items provided to the filter and order does match */
	tags?: Array<string> | undefined | null | Variable<any, string>,
	/** Matches if the field array does not contains *all* items provided to the filter or order does not match */
	tags_not?: Array<string> | undefined | null | Variable<any, string>,
	/** Matches if the field array contains *all* items provided to the filter */
	tags_contains_all?: Array<string> | undefined | null | Variable<any, string>,
	/** Matches if the field array contains at least one item provided to the filter */
	tags_contains_some?: Array<string> | undefined | null | Variable<any, string>,
	/** Matches if the field array does not contain any of the items provided to the filter */
	tags_contains_none?: Array<string> | undefined | null | Variable<any, string>,
	demo?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	demo_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	demo_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	demo_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	demo_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	demo_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	demo_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	demo_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	demo_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	demo_not_ends_with?: string | undefined | null | Variable<any, string>,
	sourceCode?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	sourceCode_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	sourceCode_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	sourceCode_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	sourceCode_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	sourceCode_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	sourceCode_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	sourceCode_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	sourceCode_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	sourceCode_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	image_every?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	image_some?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	image_none?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	/** References Project record uniquely */
["ProjectWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>
};
	["PublishLocaleInput"]: {
	/** Locales to publish */
	locale: ValueTypes["Locale"] | Variable<any, string>,
	/** Stages to publish selected locales to */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>
};
	["Query"]: AliasType<{
node?: [{	/** The ID of an object */
	id: string | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Node` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["Node"]],
users?: [{	where?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["UserOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `User` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["User"]],
user?: [{	where: ValueTypes["UserWhereUniqueInput"] | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `User` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["User"]],
usersConnection?: [{	where?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["UserOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `User` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["UserConnection"]],
assets?: [{	where?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["AssetOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Asset` will be affected directly by this argument, as well as any other related models with localized fields in the query's subtree.
The first locale matching the provided list will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["Asset"]],
asset?: [{	where: ValueTypes["AssetWhereUniqueInput"] | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Asset` will be affected directly by this argument, as well as any other related models with localized fields in the query's subtree.
The first locale matching the provided list will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["Asset"]],
assetsConnection?: [{	where?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["AssetOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Asset` will be affected directly by this argument, as well as any other related models with localized fields in the query's subtree.
The first locale matching the provided list will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["AssetConnection"]],
assetVersion?: [{	where: ValueTypes["VersionWhereInput"] | Variable<any, string>},ValueTypes["DocumentVersion"]],
scheduledOperations?: [{	where?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ScheduledOperationOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `ScheduledOperation` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["ScheduledOperation"]],
scheduledOperation?: [{	where: ValueTypes["ScheduledOperationWhereUniqueInput"] | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `ScheduledOperation` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["ScheduledOperation"]],
scheduledOperationsConnection?: [{	where?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ScheduledOperationOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `ScheduledOperation` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["ScheduledOperationConnection"]],
scheduledReleases?: [{	where?: ValueTypes["ScheduledReleaseWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ScheduledReleaseOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `ScheduledRelease` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["ScheduledRelease"]],
scheduledRelease?: [{	where: ValueTypes["ScheduledReleaseWhereUniqueInput"] | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `ScheduledRelease` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["ScheduledRelease"]],
scheduledReleasesConnection?: [{	where?: ValueTypes["ScheduledReleaseWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ScheduledReleaseOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `ScheduledRelease` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["ScheduledReleaseConnection"]],
projects?: [{	where?: ValueTypes["ProjectWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ProjectOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Project` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["Project"]],
project?: [{	where: ValueTypes["ProjectWhereUniqueInput"] | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Project` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["Project"]],
projectsConnection?: [{	where?: ValueTypes["ProjectWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ProjectOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Project` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["ProjectConnection"]],
projectVersion?: [{	where: ValueTypes["VersionWhereInput"] | Variable<any, string>},ValueTypes["DocumentVersion"]],
socials?: [{	where?: ValueTypes["SocialWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["SocialOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Social` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["Social"]],
social?: [{	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Social` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["Social"]],
socialsConnection?: [{	where?: ValueTypes["SocialWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["SocialOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Social` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["SocialConnection"]],
socialVersion?: [{	where: ValueTypes["VersionWhereInput"] | Variable<any, string>},ValueTypes["DocumentVersion"]],
pagesMetadata?: [{	where?: ValueTypes["PageMetadataWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["PageMetadataOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `PageMetadata` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["PageMetadata"]],
pageMetadata?: [{	where: ValueTypes["PageMetadataWhereUniqueInput"] | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `PageMetadata` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["PageMetadata"]],
pagesMetadataConnection?: [{	where?: ValueTypes["PageMetadataWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["PageMetadataOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `PageMetadata` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["PageMetadataConnection"]],
pageMetadataVersion?: [{	where: ValueTypes["VersionWhereInput"] | Variable<any, string>},ValueTypes["DocumentVersion"]],
skills?: [{	where?: ValueTypes["SkillWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["SkillOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Skill` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["Skill"]],
skill?: [{	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Skill` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["Skill"]],
skillsConnection?: [{	where?: ValueTypes["SkillWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["SkillOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	stage: ValueTypes["Stage"] | Variable<any, string>,	/** Defines which locales should be returned.

Note that `Skill` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ValueTypes["Locale"]> | Variable<any, string>},ValueTypes["SkillConnection"]],
skillVersion?: [{	where: ValueTypes["VersionWhereInput"] | Variable<any, string>},ValueTypes["DocumentVersion"]],
		__typename?: boolean | `@${string}`
}>;
	/** Representing a RGBA color value: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba() */
["RGBA"]: AliasType<{
	r?:boolean | `@${string}`,
	g?:boolean | `@${string}`,
	b?:boolean | `@${string}`,
	a?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["RGBAHue"]:unknown;
	/** Input type representing a RGBA color value: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba() */
["RGBAInput"]: {
	r: ValueTypes["RGBAHue"] | Variable<any, string>,
	g: ValueTypes["RGBAHue"] | Variable<any, string>,
	b: ValueTypes["RGBAHue"] | Variable<any, string>,
	a: ValueTypes["RGBATransparency"] | Variable<any, string>
};
	["RGBATransparency"]:unknown;
	/** Custom type representing a rich text value comprising of raw rich text ast, html, markdown and text values */
["RichText"]: AliasType<{
	/** Returns AST representation */
	raw?:boolean | `@${string}`,
	/** Returns HTMl representation */
	html?:boolean | `@${string}`,
	/** Returns Markdown representation */
	markdown?:boolean | `@${string}`,
	/** Returns plain-text contents of RichText */
	text?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Slate-compatible RichText AST */
["RichTextAST"]:unknown;
	/** Scheduled Operation system model */
["ScheduledOperation"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean | Variable<any, string>,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean | Variable<any, string>},ValueTypes["ScheduledOperation"]],
	/** Raw operation payload including all details, this field is subject to change */
	rawPayload?:boolean | `@${string}`,
	/** Operation error message */
	errorMessage?:boolean | `@${string}`,
	/** Operation description */
	description?:boolean | `@${string}`,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
release?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `release` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["ScheduledRelease"]],
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
	/** operation Status */
	status?:boolean | `@${string}`,
affectedDocuments?: [{	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `affectedDocuments` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["ScheduledOperationAffectedDocument"]],
		__typename?: boolean | `@${string}`
}>;
	["ScheduledOperationAffectedDocument"]: AliasType<{		["...on Asset"] : ValueTypes["Asset"],
		["...on PageMetadata"] : ValueTypes["PageMetadata"],
		["...on Project"] : ValueTypes["Project"],
		["...on Skill"] : ValueTypes["Skill"],
		["...on Social"] : ValueTypes["Social"]
		__typename?: boolean | `@${string}`
}>;
	["ScheduledOperationConnectInput"]: {
	/** Document to connect */
	where: ValueTypes["ScheduledOperationWhereUniqueInput"] | Variable<any, string>,
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ValueTypes["ConnectPositionInput"] | undefined | null | Variable<any, string>
};
	/** A connection to a list of items. */
["ScheduledOperationConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ValueTypes["PageInfo"],
	/** A list of edges. */
	edges?:ValueTypes["ScheduledOperationEdge"],
	aggregate?:ValueTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["ScheduledOperationCreateManyInlineInput"]: {
	/** Connect multiple existing ScheduledOperation documents */
	connect?: Array<ValueTypes["ScheduledOperationWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["ScheduledOperationCreateOneInlineInput"]: {
	/** Connect one existing ScheduledOperation document */
	connect?: ValueTypes["ScheduledOperationWhereUniqueInput"] | undefined | null | Variable<any, string>
};
	/** An edge in a connection. */
["ScheduledOperationEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ValueTypes["ScheduledOperation"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["ScheduledOperationManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["ScheduledOperationWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["ScheduledOperationWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["ScheduledOperationWhereInput"]> | undefined | null | Variable<any, string>,
	errorMessage?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	description_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	release?: ValueTypes["ScheduledReleaseWhereInput"] | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["ScheduledOperationStatus"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	status_not?: ValueTypes["ScheduledOperationStatus"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	status_in?: Array<ValueTypes["ScheduledOperationStatus"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ValueTypes["ScheduledOperationStatus"] | undefined | null> | undefined | null | Variable<any, string>
};
	["ScheduledOperationOrderByInput"]:ScheduledOperationOrderByInput;
	/** System Scheduled Operation Status */
["ScheduledOperationStatus"]:ScheduledOperationStatus;
	["ScheduledOperationUpdateManyInlineInput"]: {
	/** Connect multiple existing ScheduledOperation documents */
	connect?: Array<ValueTypes["ScheduledOperationConnectInput"]> | undefined | null | Variable<any, string>,
	/** Override currently-connected documents with multiple existing ScheduledOperation documents */
	set?: Array<ValueTypes["ScheduledOperationWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Disconnect multiple ScheduledOperation documents */
	disconnect?: Array<ValueTypes["ScheduledOperationWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["ScheduledOperationUpdateOneInlineInput"]: {
	/** Connect existing ScheduledOperation document */
	connect?: ValueTypes["ScheduledOperationWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Disconnect currently connected ScheduledOperation document */
	disconnect?: boolean | undefined | null | Variable<any, string>
};
	/** Identifies documents */
["ScheduledOperationWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["ScheduledOperationWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["ScheduledOperationWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["ScheduledOperationWhereInput"]> | undefined | null | Variable<any, string>,
	errorMessage?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	description_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	release?: ValueTypes["ScheduledReleaseWhereInput"] | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["ScheduledOperationStatus"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	status_not?: ValueTypes["ScheduledOperationStatus"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	status_in?: Array<ValueTypes["ScheduledOperationStatus"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ValueTypes["ScheduledOperationStatus"] | undefined | null> | undefined | null | Variable<any, string>
};
	/** References ScheduledOperation record uniquely */
["ScheduledOperationWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>
};
	/** Scheduled Release system model */
["ScheduledRelease"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean | Variable<any, string>,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean | Variable<any, string>},ValueTypes["ScheduledRelease"]],
	/** Release date and time */
	releaseAt?:boolean | `@${string}`,
	/** Whether scheduled release is implicit */
	isImplicit?:boolean | `@${string}`,
	/** Whether scheduled release should be run */
	isActive?:boolean | `@${string}`,
	/** Release error message */
	errorMessage?:boolean | `@${string}`,
	/** Release description */
	description?:boolean | `@${string}`,
	/** Release Title */
	title?:boolean | `@${string}`,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
operations?: [{	where?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,	orderBy?: ValueTypes["ScheduledOperationOrderByInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `operations` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["ScheduledOperation"]],
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
	/** Release Status */
	status?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ScheduledReleaseConnectInput"]: {
	/** Document to connect */
	where: ValueTypes["ScheduledReleaseWhereUniqueInput"] | Variable<any, string>,
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ValueTypes["ConnectPositionInput"] | undefined | null | Variable<any, string>
};
	/** A connection to a list of items. */
["ScheduledReleaseConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ValueTypes["PageInfo"],
	/** A list of edges. */
	edges?:ValueTypes["ScheduledReleaseEdge"],
	aggregate?:ValueTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["ScheduledReleaseCreateInput"]: {
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	errorMessage?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	title?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>
};
	["ScheduledReleaseCreateManyInlineInput"]: {
	/** Create and connect multiple existing ScheduledRelease documents */
	create?: Array<ValueTypes["ScheduledReleaseCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing ScheduledRelease documents */
	connect?: Array<ValueTypes["ScheduledReleaseWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["ScheduledReleaseCreateOneInlineInput"]: {
	/** Create and connect one ScheduledRelease document */
	create?: ValueTypes["ScheduledReleaseCreateInput"] | undefined | null | Variable<any, string>,
	/** Connect one existing ScheduledRelease document */
	connect?: ValueTypes["ScheduledReleaseWhereUniqueInput"] | undefined | null | Variable<any, string>
};
	/** An edge in a connection. */
["ScheduledReleaseEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ValueTypes["ScheduledRelease"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["ScheduledReleaseManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["ScheduledReleaseWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["ScheduledReleaseWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["ScheduledReleaseWhereInput"]> | undefined | null | Variable<any, string>,
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	releaseAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	releaseAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	releaseAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	releaseAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	releaseAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	releaseAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	releaseAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	isImplicit?: boolean | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	isImplicit_not?: boolean | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined | null | Variable<any, string>,
	errorMessage?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	description_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null | Variable<any, string>,
	title?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	title_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	title_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	operations_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	operations_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	operations_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["ScheduledReleaseStatus"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	status_not?: ValueTypes["ScheduledReleaseStatus"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	status_in?: Array<ValueTypes["ScheduledReleaseStatus"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ValueTypes["ScheduledReleaseStatus"] | undefined | null> | undefined | null | Variable<any, string>
};
	["ScheduledReleaseOrderByInput"]:ScheduledReleaseOrderByInput;
	/** System Scheduled Release Status */
["ScheduledReleaseStatus"]:ScheduledReleaseStatus;
	["ScheduledReleaseUpdateInput"]: {
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	errorMessage?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	title?: string | undefined | null | Variable<any, string>
};
	["ScheduledReleaseUpdateManyInlineInput"]: {
	/** Create and connect multiple ScheduledRelease documents */
	create?: Array<ValueTypes["ScheduledReleaseCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing ScheduledRelease documents */
	connect?: Array<ValueTypes["ScheduledReleaseConnectInput"]> | undefined | null | Variable<any, string>,
	/** Override currently-connected documents with multiple existing ScheduledRelease documents */
	set?: Array<ValueTypes["ScheduledReleaseWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Update multiple ScheduledRelease documents */
	update?: Array<ValueTypes["ScheduledReleaseUpdateWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Upsert multiple ScheduledRelease documents */
	upsert?: Array<ValueTypes["ScheduledReleaseUpsertWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Disconnect multiple ScheduledRelease documents */
	disconnect?: Array<ValueTypes["ScheduledReleaseWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Delete multiple ScheduledRelease documents */
	delete?: Array<ValueTypes["ScheduledReleaseWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["ScheduledReleaseUpdateManyInput"]: {
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	errorMessage?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	title?: string | undefined | null | Variable<any, string>
};
	["ScheduledReleaseUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ValueTypes["ScheduledReleaseWhereInput"] | Variable<any, string>,
	/** Update many input */
	data: ValueTypes["ScheduledReleaseUpdateManyInput"] | Variable<any, string>
};
	["ScheduledReleaseUpdateOneInlineInput"]: {
	/** Create and connect one ScheduledRelease document */
	create?: ValueTypes["ScheduledReleaseCreateInput"] | undefined | null | Variable<any, string>,
	/** Update single ScheduledRelease document */
	update?: ValueTypes["ScheduledReleaseUpdateWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Upsert single ScheduledRelease document */
	upsert?: ValueTypes["ScheduledReleaseUpsertWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Connect existing ScheduledRelease document */
	connect?: ValueTypes["ScheduledReleaseWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Disconnect currently connected ScheduledRelease document */
	disconnect?: boolean | undefined | null | Variable<any, string>,
	/** Delete currently connected ScheduledRelease document */
	delete?: boolean | undefined | null | Variable<any, string>
};
	["ScheduledReleaseUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["ScheduledReleaseWhereUniqueInput"] | Variable<any, string>,
	/** Document to update */
	data: ValueTypes["ScheduledReleaseUpdateInput"] | Variable<any, string>
};
	["ScheduledReleaseUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ValueTypes["ScheduledReleaseCreateInput"] | Variable<any, string>,
	/** Update document if it exists */
	update: ValueTypes["ScheduledReleaseUpdateInput"] | Variable<any, string>
};
	["ScheduledReleaseUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["ScheduledReleaseWhereUniqueInput"] | Variable<any, string>,
	/** Upsert data */
	data: ValueTypes["ScheduledReleaseUpsertInput"] | Variable<any, string>
};
	/** Identifies documents */
["ScheduledReleaseWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["ScheduledReleaseWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["ScheduledReleaseWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["ScheduledReleaseWhereInput"]> | undefined | null | Variable<any, string>,
	releaseAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	releaseAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	releaseAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	releaseAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	releaseAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	releaseAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	releaseAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	releaseAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	isImplicit?: boolean | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	isImplicit_not?: boolean | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined | null | Variable<any, string>,
	errorMessage?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined | null | Variable<any, string>,
	description?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	description_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null | Variable<any, string>,
	title?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	title_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	title_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	operations_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	operations_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	operations_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	status?: ValueTypes["ScheduledReleaseStatus"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	status_not?: ValueTypes["ScheduledReleaseStatus"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	status_in?: Array<ValueTypes["ScheduledReleaseStatus"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ValueTypes["ScheduledReleaseStatus"] | undefined | null> | undefined | null | Variable<any, string>
};
	/** References ScheduledRelease record uniquely */
["ScheduledReleaseWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>
};
	["Skill"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean | Variable<any, string>,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean | Variable<any, string>},ValueTypes["Skill"]],
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
icon?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `icon` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["Asset"]],
scheduledIn?: [{	where?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["ScheduledOperation"]],
history?: [{	limit: number | Variable<any, string>,	skip: number | Variable<any, string>,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ValueTypes["Stage"] | undefined | null | Variable<any, string>},ValueTypes["Version"]],
		__typename?: boolean | `@${string}`
}>;
	["SkillConnectInput"]: {
	/** Document to connect */
	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ValueTypes["ConnectPositionInput"] | undefined | null | Variable<any, string>
};
	/** A connection to a list of items. */
["SkillConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ValueTypes["PageInfo"],
	/** A list of edges. */
	edges?:ValueTypes["SkillEdge"],
	aggregate?:ValueTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["SkillCreateInput"]: {
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	icon?: ValueTypes["AssetCreateOneInlineInput"] | undefined | null | Variable<any, string>
};
	["SkillCreateManyInlineInput"]: {
	/** Create and connect multiple existing Skill documents */
	create?: Array<ValueTypes["SkillCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing Skill documents */
	connect?: Array<ValueTypes["SkillWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["SkillCreateOneInlineInput"]: {
	/** Create and connect one Skill document */
	create?: ValueTypes["SkillCreateInput"] | undefined | null | Variable<any, string>,
	/** Connect one existing Skill document */
	connect?: ValueTypes["SkillWhereUniqueInput"] | undefined | null | Variable<any, string>
};
	/** An edge in a connection. */
["SkillEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ValueTypes["Skill"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["SkillManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["SkillWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["SkillWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["SkillWhereInput"]> | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	name_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	icon?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	["SkillOrderByInput"]:SkillOrderByInput;
	["SkillUpdateInput"]: {
	name?: string | undefined | null | Variable<any, string>,
	icon?: ValueTypes["AssetUpdateOneInlineInput"] | undefined | null | Variable<any, string>
};
	["SkillUpdateManyInlineInput"]: {
	/** Create and connect multiple Skill documents */
	create?: Array<ValueTypes["SkillCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing Skill documents */
	connect?: Array<ValueTypes["SkillConnectInput"]> | undefined | null | Variable<any, string>,
	/** Override currently-connected documents with multiple existing Skill documents */
	set?: Array<ValueTypes["SkillWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Update multiple Skill documents */
	update?: Array<ValueTypes["SkillUpdateWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Upsert multiple Skill documents */
	upsert?: Array<ValueTypes["SkillUpsertWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Disconnect multiple Skill documents */
	disconnect?: Array<ValueTypes["SkillWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Delete multiple Skill documents */
	delete?: Array<ValueTypes["SkillWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["SkillUpdateManyInput"]: {
	/** No fields in updateMany data input */
	_?: string | undefined | null | Variable<any, string>
};
	["SkillUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ValueTypes["SkillWhereInput"] | Variable<any, string>,
	/** Update many input */
	data: ValueTypes["SkillUpdateManyInput"] | Variable<any, string>
};
	["SkillUpdateOneInlineInput"]: {
	/** Create and connect one Skill document */
	create?: ValueTypes["SkillCreateInput"] | undefined | null | Variable<any, string>,
	/** Update single Skill document */
	update?: ValueTypes["SkillUpdateWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Upsert single Skill document */
	upsert?: ValueTypes["SkillUpsertWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Connect existing Skill document */
	connect?: ValueTypes["SkillWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Disconnect currently connected Skill document */
	disconnect?: boolean | undefined | null | Variable<any, string>,
	/** Delete currently connected Skill document */
	delete?: boolean | undefined | null | Variable<any, string>
};
	["SkillUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,
	/** Document to update */
	data: ValueTypes["SkillUpdateInput"] | Variable<any, string>
};
	["SkillUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ValueTypes["SkillCreateInput"] | Variable<any, string>,
	/** Update document if it exists */
	update: ValueTypes["SkillUpdateInput"] | Variable<any, string>
};
	["SkillUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["SkillWhereUniqueInput"] | Variable<any, string>,
	/** Upsert data */
	data: ValueTypes["SkillUpsertInput"] | Variable<any, string>
};
	/** Identifies documents */
["SkillWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["SkillWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["SkillWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["SkillWhereInput"]> | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	name_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	icon?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	/** References Skill record uniquely */
["SkillWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>
};
	["Social"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean | Variable<any, string>,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean | Variable<any, string>},ValueTypes["Social"]],
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	/** Social media name */
	name?:boolean | `@${string}`,
	/** Social media link */
	url?:boolean | `@${string}`,
	/** Social media color */
	color?:ValueTypes["Color"],
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["User"]],
image?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `image` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["Asset"]],
scheduledIn?: [{	where?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,	skip?: number | undefined | null | Variable<any, string>,	after?: string | undefined | null | Variable<any, string>,	before?: string | undefined | null | Variable<any, string>,	first?: number | undefined | null | Variable<any, string>,	last?: number | undefined | null | Variable<any, string>,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ValueTypes["Locale"]> | undefined | null | Variable<any, string>},ValueTypes["ScheduledOperation"]],
history?: [{	limit: number | Variable<any, string>,	skip: number | Variable<any, string>,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ValueTypes["Stage"] | undefined | null | Variable<any, string>},ValueTypes["Version"]],
		__typename?: boolean | `@${string}`
}>;
	["SocialConnectInput"]: {
	/** Document to connect */
	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ValueTypes["ConnectPositionInput"] | undefined | null | Variable<any, string>
};
	/** A connection to a list of items. */
["SocialConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ValueTypes["PageInfo"],
	/** A list of edges. */
	edges?:ValueTypes["SocialEdge"],
	aggregate?:ValueTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["SocialCreateInput"]: {
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	name: string | Variable<any, string>,
	url: string | Variable<any, string>,
	color?: ValueTypes["ColorInput"] | undefined | null | Variable<any, string>,
	image: ValueTypes["AssetCreateOneInlineInput"] | Variable<any, string>
};
	["SocialCreateManyInlineInput"]: {
	/** Create and connect multiple existing Social documents */
	create?: Array<ValueTypes["SocialCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing Social documents */
	connect?: Array<ValueTypes["SocialWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["SocialCreateOneInlineInput"]: {
	/** Create and connect one Social document */
	create?: ValueTypes["SocialCreateInput"] | undefined | null | Variable<any, string>,
	/** Connect one existing Social document */
	connect?: ValueTypes["SocialWhereUniqueInput"] | undefined | null | Variable<any, string>
};
	/** An edge in a connection. */
["SocialEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ValueTypes["Social"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["SocialManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["SocialWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["SocialWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["SocialWhereInput"]> | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	name_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null | Variable<any, string>,
	url?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	url_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	url_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	url_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	url_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	url_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	url_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	url_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	url_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	url_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	image?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	["SocialOrderByInput"]:SocialOrderByInput;
	["SocialUpdateInput"]: {
	name?: string | undefined | null | Variable<any, string>,
	url?: string | undefined | null | Variable<any, string>,
	color?: ValueTypes["ColorInput"] | undefined | null | Variable<any, string>,
	image?: ValueTypes["AssetUpdateOneInlineInput"] | undefined | null | Variable<any, string>
};
	["SocialUpdateManyInlineInput"]: {
	/** Create and connect multiple Social documents */
	create?: Array<ValueTypes["SocialCreateInput"]> | undefined | null | Variable<any, string>,
	/** Connect multiple existing Social documents */
	connect?: Array<ValueTypes["SocialConnectInput"]> | undefined | null | Variable<any, string>,
	/** Override currently-connected documents with multiple existing Social documents */
	set?: Array<ValueTypes["SocialWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Update multiple Social documents */
	update?: Array<ValueTypes["SocialUpdateWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Upsert multiple Social documents */
	upsert?: Array<ValueTypes["SocialUpsertWithNestedWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Disconnect multiple Social documents */
	disconnect?: Array<ValueTypes["SocialWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Delete multiple Social documents */
	delete?: Array<ValueTypes["SocialWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["SocialUpdateManyInput"]: {
	name?: string | undefined | null | Variable<any, string>,
	color?: ValueTypes["ColorInput"] | undefined | null | Variable<any, string>
};
	["SocialUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ValueTypes["SocialWhereInput"] | Variable<any, string>,
	/** Update many input */
	data: ValueTypes["SocialUpdateManyInput"] | Variable<any, string>
};
	["SocialUpdateOneInlineInput"]: {
	/** Create and connect one Social document */
	create?: ValueTypes["SocialCreateInput"] | undefined | null | Variable<any, string>,
	/** Update single Social document */
	update?: ValueTypes["SocialUpdateWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Upsert single Social document */
	upsert?: ValueTypes["SocialUpsertWithNestedWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Connect existing Social document */
	connect?: ValueTypes["SocialWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Disconnect currently connected Social document */
	disconnect?: boolean | undefined | null | Variable<any, string>,
	/** Delete currently connected Social document */
	delete?: boolean | undefined | null | Variable<any, string>
};
	["SocialUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,
	/** Document to update */
	data: ValueTypes["SocialUpdateInput"] | Variable<any, string>
};
	["SocialUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ValueTypes["SocialCreateInput"] | Variable<any, string>,
	/** Update document if it exists */
	update: ValueTypes["SocialUpdateInput"] | Variable<any, string>
};
	["SocialUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ValueTypes["SocialWhereUniqueInput"] | Variable<any, string>,
	/** Upsert data */
	data: ValueTypes["SocialUpsertInput"] | Variable<any, string>
};
	/** Identifies documents */
["SocialWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["SocialWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["SocialWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["SocialWhereInput"]> | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	name_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null | Variable<any, string>,
	url?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	url_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	url_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	url_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	url_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	url_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	url_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	url_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	url_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	url_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	updatedBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	createdBy?: ValueTypes["UserWhereInput"] | undefined | null | Variable<any, string>,
	image?: ValueTypes["AssetWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_every?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_some?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>,
	scheduledIn_none?: ValueTypes["ScheduledOperationWhereInput"] | undefined | null | Variable<any, string>
};
	/** References Social record uniquely */
["SocialWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>,
	url?: string | undefined | null | Variable<any, string>
};
	/** Stage system enumeration */
["Stage"]:Stage;
	["SystemDateTimeFieldVariation"]:SystemDateTimeFieldVariation;
	["UnpublishLocaleInput"]: {
	/** Locales to unpublish */
	locale: ValueTypes["Locale"] | Variable<any, string>,
	/** Stages to unpublish selected locales from */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>
};
	/** User system model */
["User"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ValueTypes["Stage"]> | Variable<any, string>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean | Variable<any, string>,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean | Variable<any, string>},ValueTypes["User"]],
	/** Flag to determine if user is active or not */
	isActive?:boolean | `@${string}`,
	/** Profile Picture url */
	picture?:boolean | `@${string}`,
	/** The username */
	name?:boolean | `@${string}`,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	/** User Kind. Can be either MEMBER, PAT or PUBLIC */
	kind?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UserConnectInput"]: {
	/** Document to connect */
	where: ValueTypes["UserWhereUniqueInput"] | Variable<any, string>,
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ValueTypes["ConnectPositionInput"] | undefined | null | Variable<any, string>
};
	/** A connection to a list of items. */
["UserConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ValueTypes["PageInfo"],
	/** A list of edges. */
	edges?:ValueTypes["UserEdge"],
	aggregate?:ValueTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["UserCreateManyInlineInput"]: {
	/** Connect multiple existing User documents */
	connect?: Array<ValueTypes["UserWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["UserCreateOneInlineInput"]: {
	/** Connect one existing User document */
	connect?: ValueTypes["UserWhereUniqueInput"] | undefined | null | Variable<any, string>
};
	/** An edge in a connection. */
["UserEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ValueTypes["User"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** System User Kind */
["UserKind"]:UserKind;
	/** Identifies documents */
["UserManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["UserWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["UserWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["UserWhereInput"]> | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined | null | Variable<any, string>,
	picture?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	picture_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	picture_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	picture_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	picture_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	picture_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	picture_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	picture_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	picture_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	picture_not_ends_with?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	name_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	kind?: ValueTypes["UserKind"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	kind_not?: ValueTypes["UserKind"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	kind_in?: Array<ValueTypes["UserKind"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	kind_not_in?: Array<ValueTypes["UserKind"] | undefined | null> | undefined | null | Variable<any, string>
};
	["UserOrderByInput"]:UserOrderByInput;
	["UserUpdateManyInlineInput"]: {
	/** Connect multiple existing User documents */
	connect?: Array<ValueTypes["UserConnectInput"]> | undefined | null | Variable<any, string>,
	/** Override currently-connected documents with multiple existing User documents */
	set?: Array<ValueTypes["UserWhereUniqueInput"]> | undefined | null | Variable<any, string>,
	/** Disconnect multiple User documents */
	disconnect?: Array<ValueTypes["UserWhereUniqueInput"]> | undefined | null | Variable<any, string>
};
	["UserUpdateOneInlineInput"]: {
	/** Connect existing User document */
	connect?: ValueTypes["UserWhereUniqueInput"] | undefined | null | Variable<any, string>,
	/** Disconnect currently connected User document */
	disconnect?: boolean | undefined | null | Variable<any, string>
};
	/** Identifies documents */
["UserWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null | Variable<any, string>,
	/** Logical AND on all given filters. */
	AND?: Array<ValueTypes["UserWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical OR on all given filters. */
	OR?: Array<ValueTypes["UserWhereInput"]> | undefined | null | Variable<any, string>,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ValueTypes["UserWhereInput"]> | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined | null | Variable<any, string>,
	picture?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	picture_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	picture_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	picture_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	picture_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	picture_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	picture_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	picture_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	picture_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	picture_not_ends_with?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	name_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null | Variable<any, string>,
	publishedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	publishedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	publishedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	publishedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	updatedAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	updatedAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	updatedAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	createdAt_not?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ValueTypes["DateTime"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values less than the given value. */
	createdAt_lt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values less than or equal the given value. */
	createdAt_lte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than the given value. */
	createdAt_gt?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ValueTypes["DateTime"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	/** All values containing the given string. */
	id_contains?: string | undefined | null | Variable<any, string>,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null | Variable<any, string>,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null | Variable<any, string>,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null | Variable<any, string>,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null | Variable<any, string>,
	kind?: ValueTypes["UserKind"] | undefined | null | Variable<any, string>,
	/** All values that are not equal to given value. */
	kind_not?: ValueTypes["UserKind"] | undefined | null | Variable<any, string>,
	/** All values that are contained in given list. */
	kind_in?: Array<ValueTypes["UserKind"] | undefined | null> | undefined | null | Variable<any, string>,
	/** All values that are not contained in given list. */
	kind_not_in?: Array<ValueTypes["UserKind"] | undefined | null> | undefined | null | Variable<any, string>
};
	/** References User record uniquely */
["UserWhereUniqueInput"]: {
	id?: string | undefined | null | Variable<any, string>
};
	["Version"]: AliasType<{
	id?:boolean | `@${string}`,
	stage?:boolean | `@${string}`,
	revision?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["VersionWhereInput"]: {
	id: string | Variable<any, string>,
	stage: ValueTypes["Stage"] | Variable<any, string>,
	revision: number | Variable<any, string>
};
	["_FilterKind"]:_FilterKind;
	["_MutationInputFieldKind"]:_MutationInputFieldKind;
	["_MutationKind"]:_MutationKind;
	["_OrderDirection"]:_OrderDirection;
	["_RelationInputCardinality"]:_RelationInputCardinality;
	["_RelationInputKind"]:_RelationInputKind;
	["_RelationKind"]:_RelationKind;
	["_SystemDateTimeFieldVariation"]:_SystemDateTimeFieldVariation
  }

export type ResolverInputTypes = {
    ["Aggregate"]: AliasType<{
	count?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Asset system model */
["Asset"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
	/** System Locale field */
	locale?:boolean | `@${string}`,
localizations?: [{	/** Potential locales that should be returned */
	locales: Array<ResolverInputTypes["Locale"]>,	/** Decides if the current locale should be included or not */
	includeCurrent: boolean},ResolverInputTypes["Asset"]],
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ResolverInputTypes["Stage"]>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean},ResolverInputTypes["Asset"]],
	/** The mime type of the file */
	mimeType?:boolean | `@${string}`,
	/** The file size */
	size?:boolean | `@${string}`,
	/** The file width */
	width?:boolean | `@${string}`,
	/** The height of the file */
	height?:boolean | `@${string}`,
	/** The file name */
	fileName?:boolean | `@${string}`,
	/** The file handle */
	handle?:boolean | `@${string}`,
publishedAt?: [{	/** Variation of DateTime field to return, allows value from base document, current localization, or combined by returning the newer value of both */
	variation: ResolverInputTypes["SystemDateTimeFieldVariation"]},boolean | `@${string}`],
updatedAt?: [{	/** Variation of DateTime field to return, allows value from base document, current localization, or combined by returning the newer value of both */
	variation: ResolverInputTypes["SystemDateTimeFieldVariation"]},boolean | `@${string}`],
createdAt?: [{	/** Variation of DateTime field to return, allows value from base document, current localization, or combined by returning the newer value of both */
	variation: ResolverInputTypes["SystemDateTimeFieldVariation"]},boolean | `@${string}`],
	/** The unique identifier */
	id?:boolean | `@${string}`,
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
imageProject?: [{	where?: ResolverInputTypes["ProjectWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["ProjectOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `imageProject` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["Project"]],
imageSocial?: [{	where?: ResolverInputTypes["SocialWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["SocialOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `imageSocial` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["Social"]],
imagePageMetadata?: [{	where?: ResolverInputTypes["PageMetadataWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["PageMetadataOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `imagePageMetadata` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["PageMetadata"]],
iconSkill?: [{	where?: ResolverInputTypes["SkillWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["SkillOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `iconSkill` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["Skill"]],
scheduledIn?: [{	where?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["ScheduledOperation"]],
history?: [{	limit: number,	skip: number,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ResolverInputTypes["Stage"] | undefined | null},ResolverInputTypes["Version"]],
url?: [{	transformation?: ResolverInputTypes["AssetTransformationInput"] | undefined | null},boolean | `@${string}`],
		__typename?: boolean | `@${string}`
}>;
	["AssetConnectInput"]: {
	/** Document to connect */
	where: ResolverInputTypes["AssetWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ResolverInputTypes["ConnectPositionInput"] | undefined | null
};
	/** A connection to a list of items. */
["AssetConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ResolverInputTypes["PageInfo"],
	/** A list of edges. */
	edges?:ResolverInputTypes["AssetEdge"],
	aggregate?:ResolverInputTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["AssetCreateInput"]: {
	mimeType?: string | undefined | null,
	size?: number | undefined | null,
	width?: number | undefined | null,
	height?: number | undefined | null,
	fileName: string,
	handle: string,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	imageProject?: ResolverInputTypes["ProjectCreateManyInlineInput"] | undefined | null,
	imageSocial?: ResolverInputTypes["SocialCreateManyInlineInput"] | undefined | null,
	imagePageMetadata?: ResolverInputTypes["PageMetadataCreateManyInlineInput"] | undefined | null,
	iconSkill?: ResolverInputTypes["SkillCreateManyInlineInput"] | undefined | null,
	/** Inline mutations for managing document localizations excluding the default locale */
	localizations?: ResolverInputTypes["AssetCreateLocalizationsInput"] | undefined | null
};
	["AssetCreateLocalizationDataInput"]: {
	mimeType?: string | undefined | null,
	size?: number | undefined | null,
	width?: number | undefined | null,
	height?: number | undefined | null,
	fileName: string,
	handle: string,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null
};
	["AssetCreateLocalizationInput"]: {
	/** Localization input */
	data: ResolverInputTypes["AssetCreateLocalizationDataInput"],
	locale: ResolverInputTypes["Locale"]
};
	["AssetCreateLocalizationsInput"]: {
	/** Create localizations for the newly-created document */
	create?: Array<ResolverInputTypes["AssetCreateLocalizationInput"]> | undefined | null
};
	["AssetCreateManyInlineInput"]: {
	/** Create and connect multiple existing Asset documents */
	create?: Array<ResolverInputTypes["AssetCreateInput"]> | undefined | null,
	/** Connect multiple existing Asset documents */
	connect?: Array<ResolverInputTypes["AssetWhereUniqueInput"]> | undefined | null
};
	["AssetCreateOneInlineInput"]: {
	/** Create and connect one Asset document */
	create?: ResolverInputTypes["AssetCreateInput"] | undefined | null,
	/** Connect one existing Asset document */
	connect?: ResolverInputTypes["AssetWhereUniqueInput"] | undefined | null
};
	/** An edge in a connection. */
["AssetEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ResolverInputTypes["Asset"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["AssetManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["AssetWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["AssetWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["AssetWhereInput"]> | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	imageProject_every?: ResolverInputTypes["ProjectWhereInput"] | undefined | null,
	imageProject_some?: ResolverInputTypes["ProjectWhereInput"] | undefined | null,
	imageProject_none?: ResolverInputTypes["ProjectWhereInput"] | undefined | null,
	imageSocial_every?: ResolverInputTypes["SocialWhereInput"] | undefined | null,
	imageSocial_some?: ResolverInputTypes["SocialWhereInput"] | undefined | null,
	imageSocial_none?: ResolverInputTypes["SocialWhereInput"] | undefined | null,
	imagePageMetadata_every?: ResolverInputTypes["PageMetadataWhereInput"] | undefined | null,
	imagePageMetadata_some?: ResolverInputTypes["PageMetadataWhereInput"] | undefined | null,
	imagePageMetadata_none?: ResolverInputTypes["PageMetadataWhereInput"] | undefined | null,
	iconSkill_every?: ResolverInputTypes["SkillWhereInput"] | undefined | null,
	iconSkill_some?: ResolverInputTypes["SkillWhereInput"] | undefined | null,
	iconSkill_none?: ResolverInputTypes["SkillWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	["AssetOrderByInput"]:AssetOrderByInput;
	/** Transformations for Assets */
["AssetTransformationInput"]: {
	image?: ResolverInputTypes["ImageTransformationInput"] | undefined | null,
	document?: ResolverInputTypes["DocumentTransformationInput"] | undefined | null,
	/** Pass true if you want to validate the passed transformation parameters */
	validateOptions?: boolean | undefined | null
};
	["AssetUpdateInput"]: {
	mimeType?: string | undefined | null,
	size?: number | undefined | null,
	width?: number | undefined | null,
	height?: number | undefined | null,
	fileName?: string | undefined | null,
	handle?: string | undefined | null,
	imageProject?: ResolverInputTypes["ProjectUpdateManyInlineInput"] | undefined | null,
	imageSocial?: ResolverInputTypes["SocialUpdateManyInlineInput"] | undefined | null,
	imagePageMetadata?: ResolverInputTypes["PageMetadataUpdateManyInlineInput"] | undefined | null,
	iconSkill?: ResolverInputTypes["SkillUpdateManyInlineInput"] | undefined | null,
	/** Manage document localizations */
	localizations?: ResolverInputTypes["AssetUpdateLocalizationsInput"] | undefined | null
};
	["AssetUpdateLocalizationDataInput"]: {
	mimeType?: string | undefined | null,
	size?: number | undefined | null,
	width?: number | undefined | null,
	height?: number | undefined | null,
	fileName?: string | undefined | null,
	handle?: string | undefined | null
};
	["AssetUpdateLocalizationInput"]: {
	data: ResolverInputTypes["AssetUpdateLocalizationDataInput"],
	locale: ResolverInputTypes["Locale"]
};
	["AssetUpdateLocalizationsInput"]: {
	/** Localizations to create */
	create?: Array<ResolverInputTypes["AssetCreateLocalizationInput"]> | undefined | null,
	/** Localizations to update */
	update?: Array<ResolverInputTypes["AssetUpdateLocalizationInput"]> | undefined | null,
	upsert?: Array<ResolverInputTypes["AssetUpsertLocalizationInput"]> | undefined | null,
	/** Localizations to delete */
	delete?: Array<ResolverInputTypes["Locale"]> | undefined | null
};
	["AssetUpdateManyInlineInput"]: {
	/** Create and connect multiple Asset documents */
	create?: Array<ResolverInputTypes["AssetCreateInput"]> | undefined | null,
	/** Connect multiple existing Asset documents */
	connect?: Array<ResolverInputTypes["AssetConnectInput"]> | undefined | null,
	/** Override currently-connected documents with multiple existing Asset documents */
	set?: Array<ResolverInputTypes["AssetWhereUniqueInput"]> | undefined | null,
	/** Update multiple Asset documents */
	update?: Array<ResolverInputTypes["AssetUpdateWithNestedWhereUniqueInput"]> | undefined | null,
	/** Upsert multiple Asset documents */
	upsert?: Array<ResolverInputTypes["AssetUpsertWithNestedWhereUniqueInput"]> | undefined | null,
	/** Disconnect multiple Asset documents */
	disconnect?: Array<ResolverInputTypes["AssetWhereUniqueInput"]> | undefined | null,
	/** Delete multiple Asset documents */
	delete?: Array<ResolverInputTypes["AssetWhereUniqueInput"]> | undefined | null
};
	["AssetUpdateManyInput"]: {
	mimeType?: string | undefined | null,
	size?: number | undefined | null,
	width?: number | undefined | null,
	height?: number | undefined | null,
	fileName?: string | undefined | null,
	/** Optional updates to localizations */
	localizations?: ResolverInputTypes["AssetUpdateManyLocalizationsInput"] | undefined | null
};
	["AssetUpdateManyLocalizationDataInput"]: {
	mimeType?: string | undefined | null,
	size?: number | undefined | null,
	width?: number | undefined | null,
	height?: number | undefined | null,
	fileName?: string | undefined | null
};
	["AssetUpdateManyLocalizationInput"]: {
	data: ResolverInputTypes["AssetUpdateManyLocalizationDataInput"],
	locale: ResolverInputTypes["Locale"]
};
	["AssetUpdateManyLocalizationsInput"]: {
	/** Localizations to update */
	update?: Array<ResolverInputTypes["AssetUpdateManyLocalizationInput"]> | undefined | null
};
	["AssetUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ResolverInputTypes["AssetWhereInput"],
	/** Update many input */
	data: ResolverInputTypes["AssetUpdateManyInput"]
};
	["AssetUpdateOneInlineInput"]: {
	/** Create and connect one Asset document */
	create?: ResolverInputTypes["AssetCreateInput"] | undefined | null,
	/** Update single Asset document */
	update?: ResolverInputTypes["AssetUpdateWithNestedWhereUniqueInput"] | undefined | null,
	/** Upsert single Asset document */
	upsert?: ResolverInputTypes["AssetUpsertWithNestedWhereUniqueInput"] | undefined | null,
	/** Connect existing Asset document */
	connect?: ResolverInputTypes["AssetWhereUniqueInput"] | undefined | null,
	/** Disconnect currently connected Asset document */
	disconnect?: boolean | undefined | null,
	/** Delete currently connected Asset document */
	delete?: boolean | undefined | null
};
	["AssetUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["AssetWhereUniqueInput"],
	/** Document to update */
	data: ResolverInputTypes["AssetUpdateInput"]
};
	["AssetUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ResolverInputTypes["AssetCreateInput"],
	/** Update document if it exists */
	update: ResolverInputTypes["AssetUpdateInput"]
};
	["AssetUpsertLocalizationInput"]: {
	update: ResolverInputTypes["AssetUpdateLocalizationDataInput"],
	create: ResolverInputTypes["AssetCreateLocalizationDataInput"],
	locale: ResolverInputTypes["Locale"]
};
	["AssetUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["AssetWhereUniqueInput"],
	/** Upsert data */
	data: ResolverInputTypes["AssetUpsertInput"]
};
	/** Identifies documents */
["AssetWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["AssetWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["AssetWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["AssetWhereInput"]> | undefined | null,
	mimeType?: string | undefined | null,
	/** All values that are not equal to given value. */
	mimeType_not?: string | undefined | null,
	/** All values that are contained in given list. */
	mimeType_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	mimeType_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	mimeType_contains?: string | undefined | null,
	/** All values not containing the given string. */
	mimeType_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	mimeType_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	mimeType_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	mimeType_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	mimeType_not_ends_with?: string | undefined | null,
	size?: number | undefined | null,
	/** All values that are not equal to given value. */
	size_not?: number | undefined | null,
	/** All values that are contained in given list. */
	size_in?: Array<number | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	size_not_in?: Array<number | undefined | null> | undefined | null,
	/** All values less than the given value. */
	size_lt?: number | undefined | null,
	/** All values less than or equal the given value. */
	size_lte?: number | undefined | null,
	/** All values greater than the given value. */
	size_gt?: number | undefined | null,
	/** All values greater than or equal the given value. */
	size_gte?: number | undefined | null,
	width?: number | undefined | null,
	/** All values that are not equal to given value. */
	width_not?: number | undefined | null,
	/** All values that are contained in given list. */
	width_in?: Array<number | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	width_not_in?: Array<number | undefined | null> | undefined | null,
	/** All values less than the given value. */
	width_lt?: number | undefined | null,
	/** All values less than or equal the given value. */
	width_lte?: number | undefined | null,
	/** All values greater than the given value. */
	width_gt?: number | undefined | null,
	/** All values greater than or equal the given value. */
	width_gte?: number | undefined | null,
	height?: number | undefined | null,
	/** All values that are not equal to given value. */
	height_not?: number | undefined | null,
	/** All values that are contained in given list. */
	height_in?: Array<number | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	height_not_in?: Array<number | undefined | null> | undefined | null,
	/** All values less than the given value. */
	height_lt?: number | undefined | null,
	/** All values less than or equal the given value. */
	height_lte?: number | undefined | null,
	/** All values greater than the given value. */
	height_gt?: number | undefined | null,
	/** All values greater than or equal the given value. */
	height_gte?: number | undefined | null,
	fileName?: string | undefined | null,
	/** All values that are not equal to given value. */
	fileName_not?: string | undefined | null,
	/** All values that are contained in given list. */
	fileName_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	fileName_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	fileName_contains?: string | undefined | null,
	/** All values not containing the given string. */
	fileName_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	fileName_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	fileName_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	fileName_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	fileName_not_ends_with?: string | undefined | null,
	handle?: string | undefined | null,
	/** All values that are not equal to given value. */
	handle_not?: string | undefined | null,
	/** All values that are contained in given list. */
	handle_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	handle_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	handle_contains?: string | undefined | null,
	/** All values not containing the given string. */
	handle_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	handle_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	handle_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	handle_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	handle_not_ends_with?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	imageProject_every?: ResolverInputTypes["ProjectWhereInput"] | undefined | null,
	imageProject_some?: ResolverInputTypes["ProjectWhereInput"] | undefined | null,
	imageProject_none?: ResolverInputTypes["ProjectWhereInput"] | undefined | null,
	imageSocial_every?: ResolverInputTypes["SocialWhereInput"] | undefined | null,
	imageSocial_some?: ResolverInputTypes["SocialWhereInput"] | undefined | null,
	imageSocial_none?: ResolverInputTypes["SocialWhereInput"] | undefined | null,
	imagePageMetadata_every?: ResolverInputTypes["PageMetadataWhereInput"] | undefined | null,
	imagePageMetadata_some?: ResolverInputTypes["PageMetadataWhereInput"] | undefined | null,
	imagePageMetadata_none?: ResolverInputTypes["PageMetadataWhereInput"] | undefined | null,
	iconSkill_every?: ResolverInputTypes["SkillWhereInput"] | undefined | null,
	iconSkill_some?: ResolverInputTypes["SkillWhereInput"] | undefined | null,
	iconSkill_none?: ResolverInputTypes["SkillWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	/** References Asset record uniquely */
["AssetWhereUniqueInput"]: {
	id?: string | undefined | null
};
	["BatchPayload"]: AliasType<{
	/** The number of nodes that have been affected by the Batch operation. */
	count?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Representing a color value comprising of HEX, RGBA and css color values */
["Color"]: AliasType<{
	hex?:boolean | `@${string}`,
	rgba?:ResolverInputTypes["RGBA"],
	css?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Accepts either HEX or RGBA color value. At least one of hex or rgba value should be passed. If both are passed RGBA is used. */
["ColorInput"]: {
	hex?: ResolverInputTypes["Hex"] | undefined | null,
	rgba?: ResolverInputTypes["RGBAInput"] | undefined | null
};
	["ConnectPositionInput"]: {
	/** Connect document after specified document */
	after?: string | undefined | null,
	/** Connect document before specified document */
	before?: string | undefined | null,
	/** Connect document at first position */
	start?: boolean | undefined | null,
	/** Connect document at last position */
	end?: boolean | undefined | null
};
	/** A date string, such as 2007-12-03 (YYYY-MM-DD), compliant with ISO 8601 standard for representation of dates using the Gregorian calendar. */
["Date"]:unknown;
	/** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the date-timeformat outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representationof dates and times using the Gregorian calendar. */
["DateTime"]:unknown;
	["DocumentFileTypes"]:DocumentFileTypes;
	["DocumentOutputInput"]: {
	/** Transforms a document into a desired file type.
See this matrix for format support:

PDF:	jpg, odp, ods, odt, png, svg, txt, and webp
DOC:	docx, html, jpg, odt, pdf, png, svg, txt, and webp
DOCX:	doc, html, jpg, odt, pdf, png, svg, txt, and webp
ODT:	doc, docx, html, jpg, pdf, png, svg, txt, and webp
XLS:	jpg, pdf, ods, png, svg, xlsx, and webp
XLSX:	jpg, pdf, ods, png, svg, xls, and webp
ODS:	jpg, pdf, png, xls, svg, xlsx, and webp
PPT:	jpg, odp, pdf, png, svg, pptx, and webp
PPTX:	jpg, odp, pdf, png, svg, ppt, and webp
ODP:	jpg, pdf, png, ppt, svg, pptx, and webp
BMP:	jpg, odp, ods, odt, pdf, png, svg, and webp
GIF:	jpg, odp, ods, odt, pdf, png, svg, and webp
JPG:	jpg, odp, ods, odt, pdf, png, svg, and webp
PNG:	jpg, odp, ods, odt, pdf, png, svg, and webp
WEBP:	jpg, odp, ods, odt, pdf, png, svg, and webp
TIFF:	jpg, odp, ods, odt, pdf, png, svg, and webp
AI:	    jpg, odp, ods, odt, pdf, png, svg, and webp
PSD:	jpg, odp, ods, odt, pdf, png, svg, and webp
SVG:	jpg, odp, ods, odt, pdf, png, and webp
HTML:	jpg, odt, pdf, svg, txt, and webp
TXT:	jpg, html, odt, pdf, svg, and webp */
	format?: ResolverInputTypes["DocumentFileTypes"] | undefined | null
};
	/** Transformations for Documents */
["DocumentTransformationInput"]: {
	/** Changes the output for the file. */
	output?: ResolverInputTypes["DocumentOutputInput"] | undefined | null
};
	["DocumentVersion"]: AliasType<{
	id?:boolean | `@${string}`,
	stage?:boolean | `@${string}`,
	revision?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	data?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["Hex"]:unknown;
	["ImageFit"]:ImageFit;
	["ImageResizeInput"]: {
	/** The width in pixels to resize the image to. The value must be an integer from 1 to 10000. */
	width?: number | undefined | null,
	/** The height in pixels to resize the image to. The value must be an integer from 1 to 10000. */
	height?: number | undefined | null,
	/** The default value for the fit parameter is fit:clip. */
	fit?: ResolverInputTypes["ImageFit"] | undefined | null
};
	/** Transformations for Images */
["ImageTransformationInput"]: {
	/** Resizes the image */
	resize?: ResolverInputTypes["ImageResizeInput"] | undefined | null
};
	/** Raw JSON value */
["Json"]:unknown;
	/** Locale system enumeration */
["Locale"]:Locale;
	/** Representing a geolocation point with latitude and longitude */
["Location"]: AliasType<{
	latitude?:boolean | `@${string}`,
	longitude?:boolean | `@${string}`,
distance?: [{	from: ResolverInputTypes["LocationInput"]},boolean | `@${string}`],
		__typename?: boolean | `@${string}`
}>;
	/** Input for a geolocation point with latitude and longitude */
["LocationInput"]: {
	latitude: number,
	longitude: number
};
	/** The Long scalar type represents non-fractional signed whole numeric values. Long can represent values between -(2^63) and 2^63 - 1. */
["Long"]:unknown;
	["Mutation"]: AliasType<{
createAsset?: [{	data: ResolverInputTypes["AssetCreateInput"]},ResolverInputTypes["Asset"]],
updateAsset?: [{	where: ResolverInputTypes["AssetWhereUniqueInput"],	data: ResolverInputTypes["AssetUpdateInput"]},ResolverInputTypes["Asset"]],
deleteAsset?: [{	/** Document to delete */
	where: ResolverInputTypes["AssetWhereUniqueInput"]},ResolverInputTypes["Asset"]],
upsertAsset?: [{	where: ResolverInputTypes["AssetWhereUniqueInput"],	upsert: ResolverInputTypes["AssetUpsertInput"]},ResolverInputTypes["Asset"]],
publishAsset?: [{	/** Document to publish */
	where: ResolverInputTypes["AssetWhereUniqueInput"],	/** Optional localizations to publish */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null,	/** Whether to publish the base document */
	publishBase?: boolean | undefined | null,	/** Whether to include the default locale when publishBase is set */
	withDefaultLocale?: boolean | undefined | null,	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["Asset"]],
unpublishAsset?: [{	/** Document to unpublish */
	where: ResolverInputTypes["AssetWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>,	/** Optional locales to unpublish. Unpublishing the default locale will completely remove the document from the selected stages */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null,	/** Unpublish complete document including default localization and relations from stages. Can be disabled. */
	unpublishBase?: boolean | undefined | null},ResolverInputTypes["Asset"]],
updateManyAssetsConnection?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["AssetManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["AssetUpdateManyInput"],	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["AssetConnection"]],
deleteManyAssetsConnection?: [{	/** Documents to delete */
	where?: ResolverInputTypes["AssetManyWhereInput"] | undefined | null,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["AssetConnection"]],
publishManyAssetsConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["AssetManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	from?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null,	/** Document localizations to publish */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null,	/** Whether to publish the base document */
	publishBase?: boolean | undefined | null,	/** Whether to include the default locale when publishBase is true */
	withDefaultLocale?: boolean | undefined | null},ResolverInputTypes["AssetConnection"]],
unpublishManyAssetsConnection?: [{	/** Identifies documents in draft stage */
	where?: ResolverInputTypes["AssetManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	stage?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null,	/** Locales to unpublish */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null,	/** Whether to unpublish the base document and default localization */
	unpublishBase?: boolean | undefined | null},ResolverInputTypes["AssetConnection"]],
updateManyAssets?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["AssetManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["AssetUpdateManyInput"]},ResolverInputTypes["BatchPayload"]],
deleteManyAssets?: [{	/** Documents to delete */
	where?: ResolverInputTypes["AssetManyWhereInput"] | undefined | null},ResolverInputTypes["BatchPayload"]],
publishManyAssets?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["AssetManyWhereInput"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>,	/** Document localizations to publish */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null,	/** Whether to publish the base document */
	publishBase?: boolean | undefined | null,	/** Whether to include the default locale when publishBase is true */
	withDefaultLocale?: boolean | undefined | null},ResolverInputTypes["BatchPayload"]],
unpublishManyAssets?: [{	/** Identifies documents in each stage */
	where?: ResolverInputTypes["AssetManyWhereInput"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>,	/** Locales to unpublish */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null,	/** Whether to unpublish the base document and default localization */
	unpublishBase?: boolean | undefined | null},ResolverInputTypes["BatchPayload"]],
schedulePublishAsset?: [{	/** Document to publish */
	where: ResolverInputTypes["AssetWhereUniqueInput"],	/** Optional localizations to publish */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null,	/** Whether to publish the base document */
	publishBase?: boolean | undefined | null,	/** Whether to include the default locale when publishBase is set */
	withDefaultLocale?: boolean | undefined | null,	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null},ResolverInputTypes["Asset"]],
scheduleUnpublishAsset?: [{	/** Document to unpublish */
	where: ResolverInputTypes["AssetWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null,	/** Optional locales to unpublish. Unpublishing the default locale will completely remove the document from the selected stages */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null,	/** Unpublish complete document including default localization and relations from stages. Can be disabled. */
	unpublishBase?: boolean | undefined | null},ResolverInputTypes["Asset"]],
deleteScheduledOperation?: [{	/** Document to delete */
	where: ResolverInputTypes["ScheduledOperationWhereUniqueInput"]},ResolverInputTypes["ScheduledOperation"]],
createScheduledRelease?: [{	data: ResolverInputTypes["ScheduledReleaseCreateInput"]},ResolverInputTypes["ScheduledRelease"]],
updateScheduledRelease?: [{	where: ResolverInputTypes["ScheduledReleaseWhereUniqueInput"],	data: ResolverInputTypes["ScheduledReleaseUpdateInput"]},ResolverInputTypes["ScheduledRelease"]],
deleteScheduledRelease?: [{	/** Document to delete */
	where: ResolverInputTypes["ScheduledReleaseWhereUniqueInput"]},ResolverInputTypes["ScheduledRelease"]],
createProject?: [{	data: ResolverInputTypes["ProjectCreateInput"]},ResolverInputTypes["Project"]],
updateProject?: [{	where: ResolverInputTypes["ProjectWhereUniqueInput"],	data: ResolverInputTypes["ProjectUpdateInput"]},ResolverInputTypes["Project"]],
deleteProject?: [{	/** Document to delete */
	where: ResolverInputTypes["ProjectWhereUniqueInput"]},ResolverInputTypes["Project"]],
upsertProject?: [{	where: ResolverInputTypes["ProjectWhereUniqueInput"],	upsert: ResolverInputTypes["ProjectUpsertInput"]},ResolverInputTypes["Project"]],
publishProject?: [{	/** Document to publish */
	where: ResolverInputTypes["ProjectWhereUniqueInput"],	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["Project"]],
unpublishProject?: [{	/** Document to unpublish */
	where: ResolverInputTypes["ProjectWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["Project"]],
updateManyProjectsConnection?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["ProjectManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["ProjectUpdateManyInput"],	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["ProjectConnection"]],
deleteManyProjectsConnection?: [{	/** Documents to delete */
	where?: ResolverInputTypes["ProjectManyWhereInput"] | undefined | null,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["ProjectConnection"]],
publishManyProjectsConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["ProjectManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	from?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["ProjectConnection"]],
unpublishManyProjectsConnection?: [{	/** Identifies documents in draft stage */
	where?: ResolverInputTypes["ProjectManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	stage?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["ProjectConnection"]],
updateManyProjects?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["ProjectManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["ProjectUpdateManyInput"]},ResolverInputTypes["BatchPayload"]],
deleteManyProjects?: [{	/** Documents to delete */
	where?: ResolverInputTypes["ProjectManyWhereInput"] | undefined | null},ResolverInputTypes["BatchPayload"]],
publishManyProjects?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["ProjectManyWhereInput"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["BatchPayload"]],
unpublishManyProjects?: [{	/** Identifies documents in each stage */
	where?: ResolverInputTypes["ProjectManyWhereInput"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["BatchPayload"]],
schedulePublishProject?: [{	/** Document to publish */
	where: ResolverInputTypes["ProjectWhereUniqueInput"],	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null},ResolverInputTypes["Project"]],
scheduleUnpublishProject?: [{	/** Document to unpublish */
	where: ResolverInputTypes["ProjectWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null},ResolverInputTypes["Project"]],
createSocial?: [{	data: ResolverInputTypes["SocialCreateInput"]},ResolverInputTypes["Social"]],
updateSocial?: [{	where: ResolverInputTypes["SocialWhereUniqueInput"],	data: ResolverInputTypes["SocialUpdateInput"]},ResolverInputTypes["Social"]],
deleteSocial?: [{	/** Document to delete */
	where: ResolverInputTypes["SocialWhereUniqueInput"]},ResolverInputTypes["Social"]],
upsertSocial?: [{	where: ResolverInputTypes["SocialWhereUniqueInput"],	upsert: ResolverInputTypes["SocialUpsertInput"]},ResolverInputTypes["Social"]],
publishSocial?: [{	/** Document to publish */
	where: ResolverInputTypes["SocialWhereUniqueInput"],	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["Social"]],
unpublishSocial?: [{	/** Document to unpublish */
	where: ResolverInputTypes["SocialWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["Social"]],
updateManySocialsConnection?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["SocialManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["SocialUpdateManyInput"],	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["SocialConnection"]],
deleteManySocialsConnection?: [{	/** Documents to delete */
	where?: ResolverInputTypes["SocialManyWhereInput"] | undefined | null,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["SocialConnection"]],
publishManySocialsConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["SocialManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	from?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["SocialConnection"]],
unpublishManySocialsConnection?: [{	/** Identifies documents in draft stage */
	where?: ResolverInputTypes["SocialManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	stage?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["SocialConnection"]],
updateManySocials?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["SocialManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["SocialUpdateManyInput"]},ResolverInputTypes["BatchPayload"]],
deleteManySocials?: [{	/** Documents to delete */
	where?: ResolverInputTypes["SocialManyWhereInput"] | undefined | null},ResolverInputTypes["BatchPayload"]],
publishManySocials?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["SocialManyWhereInput"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["BatchPayload"]],
unpublishManySocials?: [{	/** Identifies documents in each stage */
	where?: ResolverInputTypes["SocialManyWhereInput"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["BatchPayload"]],
schedulePublishSocial?: [{	/** Document to publish */
	where: ResolverInputTypes["SocialWhereUniqueInput"],	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null},ResolverInputTypes["Social"]],
scheduleUnpublishSocial?: [{	/** Document to unpublish */
	where: ResolverInputTypes["SocialWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null},ResolverInputTypes["Social"]],
createPageMetadata?: [{	data: ResolverInputTypes["PageMetadataCreateInput"]},ResolverInputTypes["PageMetadata"]],
updatePageMetadata?: [{	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],	data: ResolverInputTypes["PageMetadataUpdateInput"]},ResolverInputTypes["PageMetadata"]],
deletePageMetadata?: [{	/** Document to delete */
	where: ResolverInputTypes["PageMetadataWhereUniqueInput"]},ResolverInputTypes["PageMetadata"]],
upsertPageMetadata?: [{	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],	upsert: ResolverInputTypes["PageMetadataUpsertInput"]},ResolverInputTypes["PageMetadata"]],
publishPageMetadata?: [{	/** Document to publish */
	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["PageMetadata"]],
unpublishPageMetadata?: [{	/** Document to unpublish */
	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["PageMetadata"]],
updateManyPagesMetadataConnection?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["PageMetadataManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["PageMetadataUpdateManyInput"],	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["PageMetadataConnection"]],
deleteManyPagesMetadataConnection?: [{	/** Documents to delete */
	where?: ResolverInputTypes["PageMetadataManyWhereInput"] | undefined | null,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["PageMetadataConnection"]],
publishManyPagesMetadataConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["PageMetadataManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	from?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["PageMetadataConnection"]],
unpublishManyPagesMetadataConnection?: [{	/** Identifies documents in draft stage */
	where?: ResolverInputTypes["PageMetadataManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	stage?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["PageMetadataConnection"]],
updateManyPagesMetadata?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["PageMetadataManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["PageMetadataUpdateManyInput"]},ResolverInputTypes["BatchPayload"]],
deleteManyPagesMetadata?: [{	/** Documents to delete */
	where?: ResolverInputTypes["PageMetadataManyWhereInput"] | undefined | null},ResolverInputTypes["BatchPayload"]],
publishManyPagesMetadata?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["PageMetadataManyWhereInput"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["BatchPayload"]],
unpublishManyPagesMetadata?: [{	/** Identifies documents in each stage */
	where?: ResolverInputTypes["PageMetadataManyWhereInput"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["BatchPayload"]],
schedulePublishPageMetadata?: [{	/** Document to publish */
	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null},ResolverInputTypes["PageMetadata"]],
scheduleUnpublishPageMetadata?: [{	/** Document to unpublish */
	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null},ResolverInputTypes["PageMetadata"]],
createSkill?: [{	data: ResolverInputTypes["SkillCreateInput"]},ResolverInputTypes["Skill"]],
updateSkill?: [{	where: ResolverInputTypes["SkillWhereUniqueInput"],	data: ResolverInputTypes["SkillUpdateInput"]},ResolverInputTypes["Skill"]],
deleteSkill?: [{	/** Document to delete */
	where: ResolverInputTypes["SkillWhereUniqueInput"]},ResolverInputTypes["Skill"]],
upsertSkill?: [{	where: ResolverInputTypes["SkillWhereUniqueInput"],	upsert: ResolverInputTypes["SkillUpsertInput"]},ResolverInputTypes["Skill"]],
publishSkill?: [{	/** Document to publish */
	where: ResolverInputTypes["SkillWhereUniqueInput"],	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["Skill"]],
unpublishSkill?: [{	/** Document to unpublish */
	where: ResolverInputTypes["SkillWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["Skill"]],
updateManySkillsConnection?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["SkillManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["SkillUpdateManyInput"],	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["SkillConnection"]],
deleteManySkillsConnection?: [{	/** Documents to delete */
	where?: ResolverInputTypes["SkillManyWhereInput"] | undefined | null,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["SkillConnection"]],
publishManySkillsConnection?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["SkillManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	from?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["SkillConnection"]],
unpublishManySkillsConnection?: [{	/** Identifies documents in draft stage */
	where?: ResolverInputTypes["SkillManyWhereInput"] | undefined | null,	/** Stage to find matching documents in */
	stage?: ResolverInputTypes["Stage"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>,	skip?: number | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	before?: string | undefined | null,	after?: string | undefined | null},ResolverInputTypes["SkillConnection"]],
updateManySkills?: [{	/** Documents to apply update on */
	where?: ResolverInputTypes["SkillManyWhereInput"] | undefined | null,	/** Updates to document content */
	data: ResolverInputTypes["SkillUpdateManyInput"]},ResolverInputTypes["BatchPayload"]],
deleteManySkills?: [{	/** Documents to delete */
	where?: ResolverInputTypes["SkillManyWhereInput"] | undefined | null},ResolverInputTypes["BatchPayload"]],
publishManySkills?: [{	/** Identifies documents in each stage to be published */
	where?: ResolverInputTypes["SkillManyWhereInput"] | undefined | null,	/** Stages to publish documents to */
	to: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["BatchPayload"]],
unpublishManySkills?: [{	/** Identifies documents in each stage */
	where?: ResolverInputTypes["SkillManyWhereInput"] | undefined | null,	/** Stages to unpublish documents from */
	from: Array<ResolverInputTypes["Stage"]>},ResolverInputTypes["BatchPayload"]],
schedulePublishSkill?: [{	/** Document to publish */
	where: ResolverInputTypes["SkillWhereUniqueInput"],	/** Publishing target stage */
	to: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null},ResolverInputTypes["Skill"]],
scheduleUnpublishSkill?: [{	/** Document to unpublish */
	where: ResolverInputTypes["SkillWhereUniqueInput"],	/** Stages to unpublish document from */
	from: Array<ResolverInputTypes["Stage"]>,	/** Release at point in time, will create new release containing this operation */
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,	/** Optionally attach this scheduled operation to an existing release */
	releaseId?: string | undefined | null},ResolverInputTypes["Skill"]],
		__typename?: boolean | `@${string}`
}>;
	/** An object with an ID */
["Node"]:AliasType<{
		/** The id of the object. */
	id?:boolean | `@${string}`,
	/** The Stage of an object */
	stage?:boolean | `@${string}`;
		['...on Asset']?: Omit<ResolverInputTypes["Asset"],keyof ResolverInputTypes["Node"]>;
		['...on PageMetadata']?: Omit<ResolverInputTypes["PageMetadata"],keyof ResolverInputTypes["Node"]>;
		['...on Project']?: Omit<ResolverInputTypes["Project"],keyof ResolverInputTypes["Node"]>;
		['...on ScheduledOperation']?: Omit<ResolverInputTypes["ScheduledOperation"],keyof ResolverInputTypes["Node"]>;
		['...on ScheduledRelease']?: Omit<ResolverInputTypes["ScheduledRelease"],keyof ResolverInputTypes["Node"]>;
		['...on Skill']?: Omit<ResolverInputTypes["Skill"],keyof ResolverInputTypes["Node"]>;
		['...on Social']?: Omit<ResolverInputTypes["Social"],keyof ResolverInputTypes["Node"]>;
		['...on User']?: Omit<ResolverInputTypes["User"],keyof ResolverInputTypes["Node"]>;
		__typename?: boolean | `@${string}`
}>;
	/** Information about pagination in a connection. */
["PageInfo"]: AliasType<{
	/** When paginating forwards, are there more items? */
	hasNextPage?:boolean | `@${string}`,
	/** When paginating backwards, are there more items? */
	hasPreviousPage?:boolean | `@${string}`,
	/** When paginating backwards, the cursor to continue. */
	startCursor?:boolean | `@${string}`,
	/** When paginating forwards, the cursor to continue. */
	endCursor?:boolean | `@${string}`,
	/** Number of items in the current page. */
	pageSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Page Metadata */
["PageMetadata"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ResolverInputTypes["Stage"]>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean},ResolverInputTypes["PageMetadata"]],
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	/** Page title */
	title?:boolean | `@${string}`,
	/** Page content summary */
	summary?:boolean | `@${string}`,
	/** Page slug */
	slug?:boolean | `@${string}`,
	/** Page number */
	pageNumber?:boolean | `@${string}`,
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
image?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `image` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["Asset"]],
scheduledIn?: [{	where?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["ScheduledOperation"]],
history?: [{	limit: number,	skip: number,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ResolverInputTypes["Stage"] | undefined | null},ResolverInputTypes["Version"]],
		__typename?: boolean | `@${string}`
}>;
	["PageMetadataConnectInput"]: {
	/** Document to connect */
	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ResolverInputTypes["ConnectPositionInput"] | undefined | null
};
	/** A connection to a list of items. */
["PageMetadataConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ResolverInputTypes["PageInfo"],
	/** A list of edges. */
	edges?:ResolverInputTypes["PageMetadataEdge"],
	aggregate?:ResolverInputTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["PageMetadataCreateInput"]: {
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	title: string,
	summary: string,
	slug?: string | undefined | null,
	pageNumber: number,
	image?: ResolverInputTypes["AssetCreateOneInlineInput"] | undefined | null
};
	["PageMetadataCreateManyInlineInput"]: {
	/** Create and connect multiple existing PageMetadata documents */
	create?: Array<ResolverInputTypes["PageMetadataCreateInput"]> | undefined | null,
	/** Connect multiple existing PageMetadata documents */
	connect?: Array<ResolverInputTypes["PageMetadataWhereUniqueInput"]> | undefined | null
};
	["PageMetadataCreateOneInlineInput"]: {
	/** Create and connect one PageMetadata document */
	create?: ResolverInputTypes["PageMetadataCreateInput"] | undefined | null,
	/** Connect one existing PageMetadata document */
	connect?: ResolverInputTypes["PageMetadataWhereUniqueInput"] | undefined | null
};
	/** An edge in a connection. */
["PageMetadataEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ResolverInputTypes["PageMetadata"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["PageMetadataManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["PageMetadataWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["PageMetadataWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["PageMetadataWhereInput"]> | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	title?: string | undefined | null,
	/** All values that are not equal to given value. */
	title_not?: string | undefined | null,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	title_contains?: string | undefined | null,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined | null,
	summary?: string | undefined | null,
	/** All values that are not equal to given value. */
	summary_not?: string | undefined | null,
	/** All values that are contained in given list. */
	summary_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	summary_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	summary_contains?: string | undefined | null,
	/** All values not containing the given string. */
	summary_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	summary_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	summary_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	summary_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	summary_not_ends_with?: string | undefined | null,
	slug?: string | undefined | null,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined | null,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	slug_contains?: string | undefined | null,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined | null,
	pageNumber?: number | undefined | null,
	/** All values that are not equal to given value. */
	pageNumber_not?: number | undefined | null,
	/** All values that are contained in given list. */
	pageNumber_in?: Array<number | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	pageNumber_not_in?: Array<number | undefined | null> | undefined | null,
	/** All values less than the given value. */
	pageNumber_lt?: number | undefined | null,
	/** All values less than or equal the given value. */
	pageNumber_lte?: number | undefined | null,
	/** All values greater than the given value. */
	pageNumber_gt?: number | undefined | null,
	/** All values greater than or equal the given value. */
	pageNumber_gte?: number | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	image?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	["PageMetadataOrderByInput"]:PageMetadataOrderByInput;
	["PageMetadataUpdateInput"]: {
	title?: string | undefined | null,
	summary?: string | undefined | null,
	slug?: string | undefined | null,
	pageNumber?: number | undefined | null,
	image?: ResolverInputTypes["AssetUpdateOneInlineInput"] | undefined | null
};
	["PageMetadataUpdateManyInlineInput"]: {
	/** Create and connect multiple PageMetadata documents */
	create?: Array<ResolverInputTypes["PageMetadataCreateInput"]> | undefined | null,
	/** Connect multiple existing PageMetadata documents */
	connect?: Array<ResolverInputTypes["PageMetadataConnectInput"]> | undefined | null,
	/** Override currently-connected documents with multiple existing PageMetadata documents */
	set?: Array<ResolverInputTypes["PageMetadataWhereUniqueInput"]> | undefined | null,
	/** Update multiple PageMetadata documents */
	update?: Array<ResolverInputTypes["PageMetadataUpdateWithNestedWhereUniqueInput"]> | undefined | null,
	/** Upsert multiple PageMetadata documents */
	upsert?: Array<ResolverInputTypes["PageMetadataUpsertWithNestedWhereUniqueInput"]> | undefined | null,
	/** Disconnect multiple PageMetadata documents */
	disconnect?: Array<ResolverInputTypes["PageMetadataWhereUniqueInput"]> | undefined | null,
	/** Delete multiple PageMetadata documents */
	delete?: Array<ResolverInputTypes["PageMetadataWhereUniqueInput"]> | undefined | null
};
	["PageMetadataUpdateManyInput"]: {
	summary?: string | undefined | null,
	pageNumber?: number | undefined | null
};
	["PageMetadataUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ResolverInputTypes["PageMetadataWhereInput"],
	/** Update many input */
	data: ResolverInputTypes["PageMetadataUpdateManyInput"]
};
	["PageMetadataUpdateOneInlineInput"]: {
	/** Create and connect one PageMetadata document */
	create?: ResolverInputTypes["PageMetadataCreateInput"] | undefined | null,
	/** Update single PageMetadata document */
	update?: ResolverInputTypes["PageMetadataUpdateWithNestedWhereUniqueInput"] | undefined | null,
	/** Upsert single PageMetadata document */
	upsert?: ResolverInputTypes["PageMetadataUpsertWithNestedWhereUniqueInput"] | undefined | null,
	/** Connect existing PageMetadata document */
	connect?: ResolverInputTypes["PageMetadataWhereUniqueInput"] | undefined | null,
	/** Disconnect currently connected PageMetadata document */
	disconnect?: boolean | undefined | null,
	/** Delete currently connected PageMetadata document */
	delete?: boolean | undefined | null
};
	["PageMetadataUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],
	/** Document to update */
	data: ResolverInputTypes["PageMetadataUpdateInput"]
};
	["PageMetadataUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ResolverInputTypes["PageMetadataCreateInput"],
	/** Update document if it exists */
	update: ResolverInputTypes["PageMetadataUpdateInput"]
};
	["PageMetadataUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],
	/** Upsert data */
	data: ResolverInputTypes["PageMetadataUpsertInput"]
};
	/** Identifies documents */
["PageMetadataWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["PageMetadataWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["PageMetadataWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["PageMetadataWhereInput"]> | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	title?: string | undefined | null,
	/** All values that are not equal to given value. */
	title_not?: string | undefined | null,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	title_contains?: string | undefined | null,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined | null,
	summary?: string | undefined | null,
	/** All values that are not equal to given value. */
	summary_not?: string | undefined | null,
	/** All values that are contained in given list. */
	summary_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	summary_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	summary_contains?: string | undefined | null,
	/** All values not containing the given string. */
	summary_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	summary_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	summary_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	summary_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	summary_not_ends_with?: string | undefined | null,
	slug?: string | undefined | null,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined | null,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	slug_contains?: string | undefined | null,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined | null,
	pageNumber?: number | undefined | null,
	/** All values that are not equal to given value. */
	pageNumber_not?: number | undefined | null,
	/** All values that are contained in given list. */
	pageNumber_in?: Array<number | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	pageNumber_not_in?: Array<number | undefined | null> | undefined | null,
	/** All values less than the given value. */
	pageNumber_lt?: number | undefined | null,
	/** All values less than or equal the given value. */
	pageNumber_lte?: number | undefined | null,
	/** All values greater than the given value. */
	pageNumber_gt?: number | undefined | null,
	/** All values greater than or equal the given value. */
	pageNumber_gte?: number | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	image?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	/** References PageMetadata record uniquely */
["PageMetadataWhereUniqueInput"]: {
	id?: string | undefined | null,
	title?: string | undefined | null,
	slug?: string | undefined | null
};
	["Project"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ResolverInputTypes["Stage"]>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean},ResolverInputTypes["Project"]],
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	slug?:boolean | `@${string}`,
	description?:boolean | `@${string}`,
	tags?:boolean | `@${string}`,
	demo?:boolean | `@${string}`,
	sourceCode?:boolean | `@${string}`,
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
image?: [{	where?: ResolverInputTypes["AssetWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["AssetOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `image` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["Asset"]],
scheduledIn?: [{	where?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["ScheduledOperation"]],
history?: [{	limit: number,	skip: number,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ResolverInputTypes["Stage"] | undefined | null},ResolverInputTypes["Version"]],
		__typename?: boolean | `@${string}`
}>;
	["ProjectConnectInput"]: {
	/** Document to connect */
	where: ResolverInputTypes["ProjectWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ResolverInputTypes["ConnectPositionInput"] | undefined | null
};
	/** A connection to a list of items. */
["ProjectConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ResolverInputTypes["PageInfo"],
	/** A list of edges. */
	edges?:ResolverInputTypes["ProjectEdge"],
	aggregate?:ResolverInputTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["ProjectCreateInput"]: {
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	name: string,
	slug?: string | undefined | null,
	description: string,
	tags?: Array<string> | undefined | null,
	demo?: string | undefined | null,
	sourceCode?: string | undefined | null,
	image: ResolverInputTypes["AssetCreateManyInlineInput"]
};
	["ProjectCreateManyInlineInput"]: {
	/** Create and connect multiple existing Project documents */
	create?: Array<ResolverInputTypes["ProjectCreateInput"]> | undefined | null,
	/** Connect multiple existing Project documents */
	connect?: Array<ResolverInputTypes["ProjectWhereUniqueInput"]> | undefined | null
};
	["ProjectCreateOneInlineInput"]: {
	/** Create and connect one Project document */
	create?: ResolverInputTypes["ProjectCreateInput"] | undefined | null,
	/** Connect one existing Project document */
	connect?: ResolverInputTypes["ProjectWhereUniqueInput"] | undefined | null
};
	/** An edge in a connection. */
["ProjectEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ResolverInputTypes["Project"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["ProjectManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["ProjectWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["ProjectWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["ProjectWhereInput"]> | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	name?: string | undefined | null,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	name_contains?: string | undefined | null,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null,
	slug?: string | undefined | null,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined | null,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	slug_contains?: string | undefined | null,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined | null,
	description?: string | undefined | null,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	description_contains?: string | undefined | null,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null,
	/** Matches if the field array contains *all* items provided to the filter and order does match */
	tags?: Array<string> | undefined | null,
	/** Matches if the field array does not contains *all* items provided to the filter or order does not match */
	tags_not?: Array<string> | undefined | null,
	/** Matches if the field array contains *all* items provided to the filter */
	tags_contains_all?: Array<string> | undefined | null,
	/** Matches if the field array contains at least one item provided to the filter */
	tags_contains_some?: Array<string> | undefined | null,
	/** Matches if the field array does not contain any of the items provided to the filter */
	tags_contains_none?: Array<string> | undefined | null,
	demo?: string | undefined | null,
	/** All values that are not equal to given value. */
	demo_not?: string | undefined | null,
	/** All values that are contained in given list. */
	demo_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	demo_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	demo_contains?: string | undefined | null,
	/** All values not containing the given string. */
	demo_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	demo_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	demo_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	demo_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	demo_not_ends_with?: string | undefined | null,
	sourceCode?: string | undefined | null,
	/** All values that are not equal to given value. */
	sourceCode_not?: string | undefined | null,
	/** All values that are contained in given list. */
	sourceCode_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	sourceCode_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	sourceCode_contains?: string | undefined | null,
	/** All values not containing the given string. */
	sourceCode_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	sourceCode_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	sourceCode_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	sourceCode_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	sourceCode_not_ends_with?: string | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	image_every?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	image_some?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	image_none?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	["ProjectOrderByInput"]:ProjectOrderByInput;
	["ProjectUpdateInput"]: {
	name?: string | undefined | null,
	slug?: string | undefined | null,
	description?: string | undefined | null,
	tags?: Array<string> | undefined | null,
	demo?: string | undefined | null,
	sourceCode?: string | undefined | null,
	image?: ResolverInputTypes["AssetUpdateManyInlineInput"] | undefined | null
};
	["ProjectUpdateManyInlineInput"]: {
	/** Create and connect multiple Project documents */
	create?: Array<ResolverInputTypes["ProjectCreateInput"]> | undefined | null,
	/** Connect multiple existing Project documents */
	connect?: Array<ResolverInputTypes["ProjectConnectInput"]> | undefined | null,
	/** Override currently-connected documents with multiple existing Project documents */
	set?: Array<ResolverInputTypes["ProjectWhereUniqueInput"]> | undefined | null,
	/** Update multiple Project documents */
	update?: Array<ResolverInputTypes["ProjectUpdateWithNestedWhereUniqueInput"]> | undefined | null,
	/** Upsert multiple Project documents */
	upsert?: Array<ResolverInputTypes["ProjectUpsertWithNestedWhereUniqueInput"]> | undefined | null,
	/** Disconnect multiple Project documents */
	disconnect?: Array<ResolverInputTypes["ProjectWhereUniqueInput"]> | undefined | null,
	/** Delete multiple Project documents */
	delete?: Array<ResolverInputTypes["ProjectWhereUniqueInput"]> | undefined | null
};
	["ProjectUpdateManyInput"]: {
	description?: string | undefined | null,
	tags?: Array<string> | undefined | null,
	demo?: string | undefined | null,
	sourceCode?: string | undefined | null
};
	["ProjectUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ResolverInputTypes["ProjectWhereInput"],
	/** Update many input */
	data: ResolverInputTypes["ProjectUpdateManyInput"]
};
	["ProjectUpdateOneInlineInput"]: {
	/** Create and connect one Project document */
	create?: ResolverInputTypes["ProjectCreateInput"] | undefined | null,
	/** Update single Project document */
	update?: ResolverInputTypes["ProjectUpdateWithNestedWhereUniqueInput"] | undefined | null,
	/** Upsert single Project document */
	upsert?: ResolverInputTypes["ProjectUpsertWithNestedWhereUniqueInput"] | undefined | null,
	/** Connect existing Project document */
	connect?: ResolverInputTypes["ProjectWhereUniqueInput"] | undefined | null,
	/** Disconnect currently connected Project document */
	disconnect?: boolean | undefined | null,
	/** Delete currently connected Project document */
	delete?: boolean | undefined | null
};
	["ProjectUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["ProjectWhereUniqueInput"],
	/** Document to update */
	data: ResolverInputTypes["ProjectUpdateInput"]
};
	["ProjectUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ResolverInputTypes["ProjectCreateInput"],
	/** Update document if it exists */
	update: ResolverInputTypes["ProjectUpdateInput"]
};
	["ProjectUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["ProjectWhereUniqueInput"],
	/** Upsert data */
	data: ResolverInputTypes["ProjectUpsertInput"]
};
	/** Identifies documents */
["ProjectWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["ProjectWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["ProjectWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["ProjectWhereInput"]> | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	name?: string | undefined | null,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	name_contains?: string | undefined | null,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null,
	slug?: string | undefined | null,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined | null,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	slug_contains?: string | undefined | null,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined | null,
	description?: string | undefined | null,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	description_contains?: string | undefined | null,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null,
	/** Matches if the field array contains *all* items provided to the filter and order does match */
	tags?: Array<string> | undefined | null,
	/** Matches if the field array does not contains *all* items provided to the filter or order does not match */
	tags_not?: Array<string> | undefined | null,
	/** Matches if the field array contains *all* items provided to the filter */
	tags_contains_all?: Array<string> | undefined | null,
	/** Matches if the field array contains at least one item provided to the filter */
	tags_contains_some?: Array<string> | undefined | null,
	/** Matches if the field array does not contain any of the items provided to the filter */
	tags_contains_none?: Array<string> | undefined | null,
	demo?: string | undefined | null,
	/** All values that are not equal to given value. */
	demo_not?: string | undefined | null,
	/** All values that are contained in given list. */
	demo_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	demo_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	demo_contains?: string | undefined | null,
	/** All values not containing the given string. */
	demo_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	demo_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	demo_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	demo_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	demo_not_ends_with?: string | undefined | null,
	sourceCode?: string | undefined | null,
	/** All values that are not equal to given value. */
	sourceCode_not?: string | undefined | null,
	/** All values that are contained in given list. */
	sourceCode_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	sourceCode_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	sourceCode_contains?: string | undefined | null,
	/** All values not containing the given string. */
	sourceCode_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	sourceCode_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	sourceCode_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	sourceCode_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	sourceCode_not_ends_with?: string | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	image_every?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	image_some?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	image_none?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	/** References Project record uniquely */
["ProjectWhereUniqueInput"]: {
	id?: string | undefined | null,
	name?: string | undefined | null,
	slug?: string | undefined | null
};
	["PublishLocaleInput"]: {
	/** Locales to publish */
	locale: ResolverInputTypes["Locale"],
	/** Stages to publish selected locales to */
	stages: Array<ResolverInputTypes["Stage"]>
};
	["Query"]: AliasType<{
node?: [{	/** The ID of an object */
	id: string,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Node` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["Node"]],
users?: [{	where?: ResolverInputTypes["UserWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["UserOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `User` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["User"]],
user?: [{	where: ResolverInputTypes["UserWhereUniqueInput"],	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `User` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["User"]],
usersConnection?: [{	where?: ResolverInputTypes["UserWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["UserOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `User` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["UserConnection"]],
assets?: [{	where?: ResolverInputTypes["AssetWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["AssetOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Asset` will be affected directly by this argument, as well as any other related models with localized fields in the query's subtree.
The first locale matching the provided list will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["Asset"]],
asset?: [{	where: ResolverInputTypes["AssetWhereUniqueInput"],	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Asset` will be affected directly by this argument, as well as any other related models with localized fields in the query's subtree.
The first locale matching the provided list will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["Asset"]],
assetsConnection?: [{	where?: ResolverInputTypes["AssetWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["AssetOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Asset` will be affected directly by this argument, as well as any other related models with localized fields in the query's subtree.
The first locale matching the provided list will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["AssetConnection"]],
assetVersion?: [{	where: ResolverInputTypes["VersionWhereInput"]},ResolverInputTypes["DocumentVersion"]],
scheduledOperations?: [{	where?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["ScheduledOperationOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `ScheduledOperation` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["ScheduledOperation"]],
scheduledOperation?: [{	where: ResolverInputTypes["ScheduledOperationWhereUniqueInput"],	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `ScheduledOperation` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["ScheduledOperation"]],
scheduledOperationsConnection?: [{	where?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["ScheduledOperationOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `ScheduledOperation` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["ScheduledOperationConnection"]],
scheduledReleases?: [{	where?: ResolverInputTypes["ScheduledReleaseWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["ScheduledReleaseOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `ScheduledRelease` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["ScheduledRelease"]],
scheduledRelease?: [{	where: ResolverInputTypes["ScheduledReleaseWhereUniqueInput"],	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `ScheduledRelease` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["ScheduledRelease"]],
scheduledReleasesConnection?: [{	where?: ResolverInputTypes["ScheduledReleaseWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["ScheduledReleaseOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `ScheduledRelease` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["ScheduledReleaseConnection"]],
projects?: [{	where?: ResolverInputTypes["ProjectWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["ProjectOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Project` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["Project"]],
project?: [{	where: ResolverInputTypes["ProjectWhereUniqueInput"],	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Project` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["Project"]],
projectsConnection?: [{	where?: ResolverInputTypes["ProjectWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["ProjectOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Project` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["ProjectConnection"]],
projectVersion?: [{	where: ResolverInputTypes["VersionWhereInput"]},ResolverInputTypes["DocumentVersion"]],
socials?: [{	where?: ResolverInputTypes["SocialWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["SocialOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Social` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["Social"]],
social?: [{	where: ResolverInputTypes["SocialWhereUniqueInput"],	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Social` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["Social"]],
socialsConnection?: [{	where?: ResolverInputTypes["SocialWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["SocialOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Social` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["SocialConnection"]],
socialVersion?: [{	where: ResolverInputTypes["VersionWhereInput"]},ResolverInputTypes["DocumentVersion"]],
pagesMetadata?: [{	where?: ResolverInputTypes["PageMetadataWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["PageMetadataOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `PageMetadata` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["PageMetadata"]],
pageMetadata?: [{	where: ResolverInputTypes["PageMetadataWhereUniqueInput"],	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `PageMetadata` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["PageMetadata"]],
pagesMetadataConnection?: [{	where?: ResolverInputTypes["PageMetadataWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["PageMetadataOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `PageMetadata` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["PageMetadataConnection"]],
pageMetadataVersion?: [{	where: ResolverInputTypes["VersionWhereInput"]},ResolverInputTypes["DocumentVersion"]],
skills?: [{	where?: ResolverInputTypes["SkillWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["SkillOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Skill` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["Skill"]],
skill?: [{	where: ResolverInputTypes["SkillWhereUniqueInput"],	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Skill` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["Skill"]],
skillsConnection?: [{	where?: ResolverInputTypes["SkillWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["SkillOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	stage: ResolverInputTypes["Stage"],	/** Defines which locales should be returned.

Note that `Skill` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument may be overwritten by another locales definition in a relational child field, this will effectively use the overwritten argument for the affected query's subtree. */
	locales: Array<ResolverInputTypes["Locale"]>},ResolverInputTypes["SkillConnection"]],
skillVersion?: [{	where: ResolverInputTypes["VersionWhereInput"]},ResolverInputTypes["DocumentVersion"]],
		__typename?: boolean | `@${string}`
}>;
	/** Representing a RGBA color value: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba() */
["RGBA"]: AliasType<{
	r?:boolean | `@${string}`,
	g?:boolean | `@${string}`,
	b?:boolean | `@${string}`,
	a?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["RGBAHue"]:unknown;
	/** Input type representing a RGBA color value: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba() */
["RGBAInput"]: {
	r: ResolverInputTypes["RGBAHue"],
	g: ResolverInputTypes["RGBAHue"],
	b: ResolverInputTypes["RGBAHue"],
	a: ResolverInputTypes["RGBATransparency"]
};
	["RGBATransparency"]:unknown;
	/** Custom type representing a rich text value comprising of raw rich text ast, html, markdown and text values */
["RichText"]: AliasType<{
	/** Returns AST representation */
	raw?:boolean | `@${string}`,
	/** Returns HTMl representation */
	html?:boolean | `@${string}`,
	/** Returns Markdown representation */
	markdown?:boolean | `@${string}`,
	/** Returns plain-text contents of RichText */
	text?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Slate-compatible RichText AST */
["RichTextAST"]:unknown;
	/** Scheduled Operation system model */
["ScheduledOperation"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ResolverInputTypes["Stage"]>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean},ResolverInputTypes["ScheduledOperation"]],
	/** Raw operation payload including all details, this field is subject to change */
	rawPayload?:boolean | `@${string}`,
	/** Operation error message */
	errorMessage?:boolean | `@${string}`,
	/** Operation description */
	description?:boolean | `@${string}`,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
release?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `release` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["ScheduledRelease"]],
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
	/** operation Status */
	status?:boolean | `@${string}`,
affectedDocuments?: [{	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `affectedDocuments` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["ScheduledOperationAffectedDocument"]],
		__typename?: boolean | `@${string}`
}>;
	["ScheduledOperationAffectedDocument"]: AliasType<{
	Asset?:ResolverInputTypes["Asset"],
	PageMetadata?:ResolverInputTypes["PageMetadata"],
	Project?:ResolverInputTypes["Project"],
	Skill?:ResolverInputTypes["Skill"],
	Social?:ResolverInputTypes["Social"],
		__typename?: boolean | `@${string}`
}>;
	["ScheduledOperationConnectInput"]: {
	/** Document to connect */
	where: ResolverInputTypes["ScheduledOperationWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ResolverInputTypes["ConnectPositionInput"] | undefined | null
};
	/** A connection to a list of items. */
["ScheduledOperationConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ResolverInputTypes["PageInfo"],
	/** A list of edges. */
	edges?:ResolverInputTypes["ScheduledOperationEdge"],
	aggregate?:ResolverInputTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["ScheduledOperationCreateManyInlineInput"]: {
	/** Connect multiple existing ScheduledOperation documents */
	connect?: Array<ResolverInputTypes["ScheduledOperationWhereUniqueInput"]> | undefined | null
};
	["ScheduledOperationCreateOneInlineInput"]: {
	/** Connect one existing ScheduledOperation document */
	connect?: ResolverInputTypes["ScheduledOperationWhereUniqueInput"] | undefined | null
};
	/** An edge in a connection. */
["ScheduledOperationEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ResolverInputTypes["ScheduledOperation"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["ScheduledOperationManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["ScheduledOperationWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["ScheduledOperationWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["ScheduledOperationWhereInput"]> | undefined | null,
	errorMessage?: string | undefined | null,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined | null,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined | null,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined | null,
	description?: string | undefined | null,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	description_contains?: string | undefined | null,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	release?: ResolverInputTypes["ScheduledReleaseWhereInput"] | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	status?: ResolverInputTypes["ScheduledOperationStatus"] | undefined | null,
	/** All values that are not equal to given value. */
	status_not?: ResolverInputTypes["ScheduledOperationStatus"] | undefined | null,
	/** All values that are contained in given list. */
	status_in?: Array<ResolverInputTypes["ScheduledOperationStatus"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ResolverInputTypes["ScheduledOperationStatus"] | undefined | null> | undefined | null
};
	["ScheduledOperationOrderByInput"]:ScheduledOperationOrderByInput;
	/** System Scheduled Operation Status */
["ScheduledOperationStatus"]:ScheduledOperationStatus;
	["ScheduledOperationUpdateManyInlineInput"]: {
	/** Connect multiple existing ScheduledOperation documents */
	connect?: Array<ResolverInputTypes["ScheduledOperationConnectInput"]> | undefined | null,
	/** Override currently-connected documents with multiple existing ScheduledOperation documents */
	set?: Array<ResolverInputTypes["ScheduledOperationWhereUniqueInput"]> | undefined | null,
	/** Disconnect multiple ScheduledOperation documents */
	disconnect?: Array<ResolverInputTypes["ScheduledOperationWhereUniqueInput"]> | undefined | null
};
	["ScheduledOperationUpdateOneInlineInput"]: {
	/** Connect existing ScheduledOperation document */
	connect?: ResolverInputTypes["ScheduledOperationWhereUniqueInput"] | undefined | null,
	/** Disconnect currently connected ScheduledOperation document */
	disconnect?: boolean | undefined | null
};
	/** Identifies documents */
["ScheduledOperationWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["ScheduledOperationWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["ScheduledOperationWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["ScheduledOperationWhereInput"]> | undefined | null,
	errorMessage?: string | undefined | null,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined | null,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined | null,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined | null,
	description?: string | undefined | null,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	description_contains?: string | undefined | null,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	release?: ResolverInputTypes["ScheduledReleaseWhereInput"] | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	status?: ResolverInputTypes["ScheduledOperationStatus"] | undefined | null,
	/** All values that are not equal to given value. */
	status_not?: ResolverInputTypes["ScheduledOperationStatus"] | undefined | null,
	/** All values that are contained in given list. */
	status_in?: Array<ResolverInputTypes["ScheduledOperationStatus"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ResolverInputTypes["ScheduledOperationStatus"] | undefined | null> | undefined | null
};
	/** References ScheduledOperation record uniquely */
["ScheduledOperationWhereUniqueInput"]: {
	id?: string | undefined | null
};
	/** Scheduled Release system model */
["ScheduledRelease"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ResolverInputTypes["Stage"]>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean},ResolverInputTypes["ScheduledRelease"]],
	/** Release date and time */
	releaseAt?:boolean | `@${string}`,
	/** Whether scheduled release is implicit */
	isImplicit?:boolean | `@${string}`,
	/** Whether scheduled release should be run */
	isActive?:boolean | `@${string}`,
	/** Release error message */
	errorMessage?:boolean | `@${string}`,
	/** Release description */
	description?:boolean | `@${string}`,
	/** Release Title */
	title?:boolean | `@${string}`,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
operations?: [{	where?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,	orderBy?: ResolverInputTypes["ScheduledOperationOrderByInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `operations` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["ScheduledOperation"]],
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
	/** Release Status */
	status?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["ScheduledReleaseConnectInput"]: {
	/** Document to connect */
	where: ResolverInputTypes["ScheduledReleaseWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ResolverInputTypes["ConnectPositionInput"] | undefined | null
};
	/** A connection to a list of items. */
["ScheduledReleaseConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ResolverInputTypes["PageInfo"],
	/** A list of edges. */
	edges?:ResolverInputTypes["ScheduledReleaseEdge"],
	aggregate?:ResolverInputTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["ScheduledReleaseCreateInput"]: {
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,
	isActive?: boolean | undefined | null,
	errorMessage?: string | undefined | null,
	description?: string | undefined | null,
	title?: string | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null
};
	["ScheduledReleaseCreateManyInlineInput"]: {
	/** Create and connect multiple existing ScheduledRelease documents */
	create?: Array<ResolverInputTypes["ScheduledReleaseCreateInput"]> | undefined | null,
	/** Connect multiple existing ScheduledRelease documents */
	connect?: Array<ResolverInputTypes["ScheduledReleaseWhereUniqueInput"]> | undefined | null
};
	["ScheduledReleaseCreateOneInlineInput"]: {
	/** Create and connect one ScheduledRelease document */
	create?: ResolverInputTypes["ScheduledReleaseCreateInput"] | undefined | null,
	/** Connect one existing ScheduledRelease document */
	connect?: ResolverInputTypes["ScheduledReleaseWhereUniqueInput"] | undefined | null
};
	/** An edge in a connection. */
["ScheduledReleaseEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ResolverInputTypes["ScheduledRelease"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["ScheduledReleaseManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["ScheduledReleaseWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["ScheduledReleaseWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["ScheduledReleaseWhereInput"]> | undefined | null,
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	releaseAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	releaseAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	releaseAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	releaseAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	releaseAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	releaseAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	releaseAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	isImplicit?: boolean | undefined | null,
	/** All values that are not equal to given value. */
	isImplicit_not?: boolean | undefined | null,
	isActive?: boolean | undefined | null,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined | null,
	errorMessage?: string | undefined | null,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined | null,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined | null,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined | null,
	description?: string | undefined | null,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	description_contains?: string | undefined | null,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null,
	title?: string | undefined | null,
	/** All values that are not equal to given value. */
	title_not?: string | undefined | null,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	title_contains?: string | undefined | null,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	operations_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	operations_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	operations_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	status?: ResolverInputTypes["ScheduledReleaseStatus"] | undefined | null,
	/** All values that are not equal to given value. */
	status_not?: ResolverInputTypes["ScheduledReleaseStatus"] | undefined | null,
	/** All values that are contained in given list. */
	status_in?: Array<ResolverInputTypes["ScheduledReleaseStatus"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ResolverInputTypes["ScheduledReleaseStatus"] | undefined | null> | undefined | null
};
	["ScheduledReleaseOrderByInput"]:ScheduledReleaseOrderByInput;
	/** System Scheduled Release Status */
["ScheduledReleaseStatus"]:ScheduledReleaseStatus;
	["ScheduledReleaseUpdateInput"]: {
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,
	isActive?: boolean | undefined | null,
	errorMessage?: string | undefined | null,
	description?: string | undefined | null,
	title?: string | undefined | null
};
	["ScheduledReleaseUpdateManyInlineInput"]: {
	/** Create and connect multiple ScheduledRelease documents */
	create?: Array<ResolverInputTypes["ScheduledReleaseCreateInput"]> | undefined | null,
	/** Connect multiple existing ScheduledRelease documents */
	connect?: Array<ResolverInputTypes["ScheduledReleaseConnectInput"]> | undefined | null,
	/** Override currently-connected documents with multiple existing ScheduledRelease documents */
	set?: Array<ResolverInputTypes["ScheduledReleaseWhereUniqueInput"]> | undefined | null,
	/** Update multiple ScheduledRelease documents */
	update?: Array<ResolverInputTypes["ScheduledReleaseUpdateWithNestedWhereUniqueInput"]> | undefined | null,
	/** Upsert multiple ScheduledRelease documents */
	upsert?: Array<ResolverInputTypes["ScheduledReleaseUpsertWithNestedWhereUniqueInput"]> | undefined | null,
	/** Disconnect multiple ScheduledRelease documents */
	disconnect?: Array<ResolverInputTypes["ScheduledReleaseWhereUniqueInput"]> | undefined | null,
	/** Delete multiple ScheduledRelease documents */
	delete?: Array<ResolverInputTypes["ScheduledReleaseWhereUniqueInput"]> | undefined | null
};
	["ScheduledReleaseUpdateManyInput"]: {
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,
	isActive?: boolean | undefined | null,
	errorMessage?: string | undefined | null,
	description?: string | undefined | null,
	title?: string | undefined | null
};
	["ScheduledReleaseUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ResolverInputTypes["ScheduledReleaseWhereInput"],
	/** Update many input */
	data: ResolverInputTypes["ScheduledReleaseUpdateManyInput"]
};
	["ScheduledReleaseUpdateOneInlineInput"]: {
	/** Create and connect one ScheduledRelease document */
	create?: ResolverInputTypes["ScheduledReleaseCreateInput"] | undefined | null,
	/** Update single ScheduledRelease document */
	update?: ResolverInputTypes["ScheduledReleaseUpdateWithNestedWhereUniqueInput"] | undefined | null,
	/** Upsert single ScheduledRelease document */
	upsert?: ResolverInputTypes["ScheduledReleaseUpsertWithNestedWhereUniqueInput"] | undefined | null,
	/** Connect existing ScheduledRelease document */
	connect?: ResolverInputTypes["ScheduledReleaseWhereUniqueInput"] | undefined | null,
	/** Disconnect currently connected ScheduledRelease document */
	disconnect?: boolean | undefined | null,
	/** Delete currently connected ScheduledRelease document */
	delete?: boolean | undefined | null
};
	["ScheduledReleaseUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["ScheduledReleaseWhereUniqueInput"],
	/** Document to update */
	data: ResolverInputTypes["ScheduledReleaseUpdateInput"]
};
	["ScheduledReleaseUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ResolverInputTypes["ScheduledReleaseCreateInput"],
	/** Update document if it exists */
	update: ResolverInputTypes["ScheduledReleaseUpdateInput"]
};
	["ScheduledReleaseUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["ScheduledReleaseWhereUniqueInput"],
	/** Upsert data */
	data: ResolverInputTypes["ScheduledReleaseUpsertInput"]
};
	/** Identifies documents */
["ScheduledReleaseWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["ScheduledReleaseWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["ScheduledReleaseWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["ScheduledReleaseWhereInput"]> | undefined | null,
	releaseAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	releaseAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	releaseAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	releaseAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	releaseAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	releaseAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	releaseAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	releaseAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	isImplicit?: boolean | undefined | null,
	/** All values that are not equal to given value. */
	isImplicit_not?: boolean | undefined | null,
	isActive?: boolean | undefined | null,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined | null,
	errorMessage?: string | undefined | null,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined | null,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined | null,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined | null,
	description?: string | undefined | null,
	/** All values that are not equal to given value. */
	description_not?: string | undefined | null,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	description_contains?: string | undefined | null,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined | null,
	title?: string | undefined | null,
	/** All values that are not equal to given value. */
	title_not?: string | undefined | null,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	title_contains?: string | undefined | null,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	operations_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	operations_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	operations_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	status?: ResolverInputTypes["ScheduledReleaseStatus"] | undefined | null,
	/** All values that are not equal to given value. */
	status_not?: ResolverInputTypes["ScheduledReleaseStatus"] | undefined | null,
	/** All values that are contained in given list. */
	status_in?: Array<ResolverInputTypes["ScheduledReleaseStatus"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ResolverInputTypes["ScheduledReleaseStatus"] | undefined | null> | undefined | null
};
	/** References ScheduledRelease record uniquely */
["ScheduledReleaseWhereUniqueInput"]: {
	id?: string | undefined | null
};
	["Skill"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ResolverInputTypes["Stage"]>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean},ResolverInputTypes["Skill"]],
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
icon?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `icon` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["Asset"]],
scheduledIn?: [{	where?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["ScheduledOperation"]],
history?: [{	limit: number,	skip: number,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ResolverInputTypes["Stage"] | undefined | null},ResolverInputTypes["Version"]],
		__typename?: boolean | `@${string}`
}>;
	["SkillConnectInput"]: {
	/** Document to connect */
	where: ResolverInputTypes["SkillWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ResolverInputTypes["ConnectPositionInput"] | undefined | null
};
	/** A connection to a list of items. */
["SkillConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ResolverInputTypes["PageInfo"],
	/** A list of edges. */
	edges?:ResolverInputTypes["SkillEdge"],
	aggregate?:ResolverInputTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["SkillCreateInput"]: {
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	name: string,
	icon?: ResolverInputTypes["AssetCreateOneInlineInput"] | undefined | null
};
	["SkillCreateManyInlineInput"]: {
	/** Create and connect multiple existing Skill documents */
	create?: Array<ResolverInputTypes["SkillCreateInput"]> | undefined | null,
	/** Connect multiple existing Skill documents */
	connect?: Array<ResolverInputTypes["SkillWhereUniqueInput"]> | undefined | null
};
	["SkillCreateOneInlineInput"]: {
	/** Create and connect one Skill document */
	create?: ResolverInputTypes["SkillCreateInput"] | undefined | null,
	/** Connect one existing Skill document */
	connect?: ResolverInputTypes["SkillWhereUniqueInput"] | undefined | null
};
	/** An edge in a connection. */
["SkillEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ResolverInputTypes["Skill"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["SkillManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["SkillWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["SkillWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["SkillWhereInput"]> | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	name?: string | undefined | null,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	name_contains?: string | undefined | null,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	icon?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	["SkillOrderByInput"]:SkillOrderByInput;
	["SkillUpdateInput"]: {
	name?: string | undefined | null,
	icon?: ResolverInputTypes["AssetUpdateOneInlineInput"] | undefined | null
};
	["SkillUpdateManyInlineInput"]: {
	/** Create and connect multiple Skill documents */
	create?: Array<ResolverInputTypes["SkillCreateInput"]> | undefined | null,
	/** Connect multiple existing Skill documents */
	connect?: Array<ResolverInputTypes["SkillConnectInput"]> | undefined | null,
	/** Override currently-connected documents with multiple existing Skill documents */
	set?: Array<ResolverInputTypes["SkillWhereUniqueInput"]> | undefined | null,
	/** Update multiple Skill documents */
	update?: Array<ResolverInputTypes["SkillUpdateWithNestedWhereUniqueInput"]> | undefined | null,
	/** Upsert multiple Skill documents */
	upsert?: Array<ResolverInputTypes["SkillUpsertWithNestedWhereUniqueInput"]> | undefined | null,
	/** Disconnect multiple Skill documents */
	disconnect?: Array<ResolverInputTypes["SkillWhereUniqueInput"]> | undefined | null,
	/** Delete multiple Skill documents */
	delete?: Array<ResolverInputTypes["SkillWhereUniqueInput"]> | undefined | null
};
	["SkillUpdateManyInput"]: {
	/** No fields in updateMany data input */
	_?: string | undefined | null
};
	["SkillUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ResolverInputTypes["SkillWhereInput"],
	/** Update many input */
	data: ResolverInputTypes["SkillUpdateManyInput"]
};
	["SkillUpdateOneInlineInput"]: {
	/** Create and connect one Skill document */
	create?: ResolverInputTypes["SkillCreateInput"] | undefined | null,
	/** Update single Skill document */
	update?: ResolverInputTypes["SkillUpdateWithNestedWhereUniqueInput"] | undefined | null,
	/** Upsert single Skill document */
	upsert?: ResolverInputTypes["SkillUpsertWithNestedWhereUniqueInput"] | undefined | null,
	/** Connect existing Skill document */
	connect?: ResolverInputTypes["SkillWhereUniqueInput"] | undefined | null,
	/** Disconnect currently connected Skill document */
	disconnect?: boolean | undefined | null,
	/** Delete currently connected Skill document */
	delete?: boolean | undefined | null
};
	["SkillUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["SkillWhereUniqueInput"],
	/** Document to update */
	data: ResolverInputTypes["SkillUpdateInput"]
};
	["SkillUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ResolverInputTypes["SkillCreateInput"],
	/** Update document if it exists */
	update: ResolverInputTypes["SkillUpdateInput"]
};
	["SkillUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["SkillWhereUniqueInput"],
	/** Upsert data */
	data: ResolverInputTypes["SkillUpsertInput"]
};
	/** Identifies documents */
["SkillWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["SkillWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["SkillWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["SkillWhereInput"]> | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	name?: string | undefined | null,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	name_contains?: string | undefined | null,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	icon?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	/** References Skill record uniquely */
["SkillWhereUniqueInput"]: {
	id?: string | undefined | null,
	name?: string | undefined | null
};
	["Social"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ResolverInputTypes["Stage"]>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean},ResolverInputTypes["Social"]],
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	/** Social media name */
	name?:boolean | `@${string}`,
	/** Social media link */
	url?:boolean | `@${string}`,
	/** Social media color */
	color?:ResolverInputTypes["Color"],
publishedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `publishedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
updatedBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `updatedBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
createdBy?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `createdBy` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["User"]],
image?: [{	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `image` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["Asset"]],
scheduledIn?: [{	where?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,	skip?: number | undefined | null,	after?: string | undefined | null,	before?: string | undefined | null,	first?: number | undefined | null,	last?: number | undefined | null,	/** Allows to optionally override locale filtering behaviour in the query's subtree.

Note that `scheduledIn` is a model without localized fields and will not be affected directly by this argument, however the locales will be passed on to any relational fields in the query's subtree for filtering.
For related models with localized fields in the query's subtree, the first locale matching the provided list of locales will be returned, entries with non matching locales will be filtered out.

This argument will overwrite any existing locale filtering defined in the query's tree for the subtree. */
	locales?: Array<ResolverInputTypes["Locale"]> | undefined | null},ResolverInputTypes["ScheduledOperation"]],
history?: [{	limit: number,	skip: number,	/** This is optional and can be used to fetch the document version history for a specific stage instead of the current one */
	stageOverride?: ResolverInputTypes["Stage"] | undefined | null},ResolverInputTypes["Version"]],
		__typename?: boolean | `@${string}`
}>;
	["SocialConnectInput"]: {
	/** Document to connect */
	where: ResolverInputTypes["SocialWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ResolverInputTypes["ConnectPositionInput"] | undefined | null
};
	/** A connection to a list of items. */
["SocialConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ResolverInputTypes["PageInfo"],
	/** A list of edges. */
	edges?:ResolverInputTypes["SocialEdge"],
	aggregate?:ResolverInputTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["SocialCreateInput"]: {
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	name: string,
	url: string,
	color?: ResolverInputTypes["ColorInput"] | undefined | null,
	image: ResolverInputTypes["AssetCreateOneInlineInput"]
};
	["SocialCreateManyInlineInput"]: {
	/** Create and connect multiple existing Social documents */
	create?: Array<ResolverInputTypes["SocialCreateInput"]> | undefined | null,
	/** Connect multiple existing Social documents */
	connect?: Array<ResolverInputTypes["SocialWhereUniqueInput"]> | undefined | null
};
	["SocialCreateOneInlineInput"]: {
	/** Create and connect one Social document */
	create?: ResolverInputTypes["SocialCreateInput"] | undefined | null,
	/** Connect one existing Social document */
	connect?: ResolverInputTypes["SocialWhereUniqueInput"] | undefined | null
};
	/** An edge in a connection. */
["SocialEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ResolverInputTypes["Social"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Identifies documents */
["SocialManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["SocialWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["SocialWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["SocialWhereInput"]> | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	name?: string | undefined | null,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	name_contains?: string | undefined | null,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null,
	url?: string | undefined | null,
	/** All values that are not equal to given value. */
	url_not?: string | undefined | null,
	/** All values that are contained in given list. */
	url_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	url_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	url_contains?: string | undefined | null,
	/** All values not containing the given string. */
	url_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	url_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	url_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	url_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	url_not_ends_with?: string | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	image?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	["SocialOrderByInput"]:SocialOrderByInput;
	["SocialUpdateInput"]: {
	name?: string | undefined | null,
	url?: string | undefined | null,
	color?: ResolverInputTypes["ColorInput"] | undefined | null,
	image?: ResolverInputTypes["AssetUpdateOneInlineInput"] | undefined | null
};
	["SocialUpdateManyInlineInput"]: {
	/** Create and connect multiple Social documents */
	create?: Array<ResolverInputTypes["SocialCreateInput"]> | undefined | null,
	/** Connect multiple existing Social documents */
	connect?: Array<ResolverInputTypes["SocialConnectInput"]> | undefined | null,
	/** Override currently-connected documents with multiple existing Social documents */
	set?: Array<ResolverInputTypes["SocialWhereUniqueInput"]> | undefined | null,
	/** Update multiple Social documents */
	update?: Array<ResolverInputTypes["SocialUpdateWithNestedWhereUniqueInput"]> | undefined | null,
	/** Upsert multiple Social documents */
	upsert?: Array<ResolverInputTypes["SocialUpsertWithNestedWhereUniqueInput"]> | undefined | null,
	/** Disconnect multiple Social documents */
	disconnect?: Array<ResolverInputTypes["SocialWhereUniqueInput"]> | undefined | null,
	/** Delete multiple Social documents */
	delete?: Array<ResolverInputTypes["SocialWhereUniqueInput"]> | undefined | null
};
	["SocialUpdateManyInput"]: {
	name?: string | undefined | null,
	color?: ResolverInputTypes["ColorInput"] | undefined | null
};
	["SocialUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ResolverInputTypes["SocialWhereInput"],
	/** Update many input */
	data: ResolverInputTypes["SocialUpdateManyInput"]
};
	["SocialUpdateOneInlineInput"]: {
	/** Create and connect one Social document */
	create?: ResolverInputTypes["SocialCreateInput"] | undefined | null,
	/** Update single Social document */
	update?: ResolverInputTypes["SocialUpdateWithNestedWhereUniqueInput"] | undefined | null,
	/** Upsert single Social document */
	upsert?: ResolverInputTypes["SocialUpsertWithNestedWhereUniqueInput"] | undefined | null,
	/** Connect existing Social document */
	connect?: ResolverInputTypes["SocialWhereUniqueInput"] | undefined | null,
	/** Disconnect currently connected Social document */
	disconnect?: boolean | undefined | null,
	/** Delete currently connected Social document */
	delete?: boolean | undefined | null
};
	["SocialUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["SocialWhereUniqueInput"],
	/** Document to update */
	data: ResolverInputTypes["SocialUpdateInput"]
};
	["SocialUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ResolverInputTypes["SocialCreateInput"],
	/** Update document if it exists */
	update: ResolverInputTypes["SocialUpdateInput"]
};
	["SocialUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ResolverInputTypes["SocialWhereUniqueInput"],
	/** Upsert data */
	data: ResolverInputTypes["SocialUpsertInput"]
};
	/** Identifies documents */
["SocialWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["SocialWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["SocialWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["SocialWhereInput"]> | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	name?: string | undefined | null,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	name_contains?: string | undefined | null,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null,
	url?: string | undefined | null,
	/** All values that are not equal to given value. */
	url_not?: string | undefined | null,
	/** All values that are contained in given list. */
	url_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	url_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	url_contains?: string | undefined | null,
	/** All values not containing the given string. */
	url_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	url_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	url_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	url_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	url_not_ends_with?: string | undefined | null,
	publishedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	updatedBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	createdBy?: ResolverInputTypes["UserWhereInput"] | undefined | null,
	image?: ResolverInputTypes["AssetWhereInput"] | undefined | null,
	scheduledIn_every?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_some?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null,
	scheduledIn_none?: ResolverInputTypes["ScheduledOperationWhereInput"] | undefined | null
};
	/** References Social record uniquely */
["SocialWhereUniqueInput"]: {
	id?: string | undefined | null,
	url?: string | undefined | null
};
	/** Stage system enumeration */
["Stage"]:Stage;
	["SystemDateTimeFieldVariation"]:SystemDateTimeFieldVariation;
	["UnpublishLocaleInput"]: {
	/** Locales to unpublish */
	locale: ResolverInputTypes["Locale"],
	/** Stages to unpublish selected locales from */
	stages: Array<ResolverInputTypes["Stage"]>
};
	/** User system model */
["User"]: AliasType<{
	/** System stage field */
	stage?:boolean | `@${string}`,
documentInStages?: [{	/** Potential stages that should be returned */
	stages: Array<ResolverInputTypes["Stage"]>,	/** Decides if the current stage should be included or not */
	includeCurrent: boolean,	/** Decides if the documents should match the parent documents locale or should use the fallback order defined in the tree */
	inheritLocale: boolean},ResolverInputTypes["User"]],
	/** Flag to determine if user is active or not */
	isActive?:boolean | `@${string}`,
	/** Profile Picture url */
	picture?:boolean | `@${string}`,
	/** The username */
	name?:boolean | `@${string}`,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?:boolean | `@${string}`,
	/** The time the document was updated */
	updatedAt?:boolean | `@${string}`,
	/** The time the document was created */
	createdAt?:boolean | `@${string}`,
	/** The unique identifier */
	id?:boolean | `@${string}`,
	/** User Kind. Can be either MEMBER, PAT or PUBLIC */
	kind?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["UserConnectInput"]: {
	/** Document to connect */
	where: ResolverInputTypes["UserWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ResolverInputTypes["ConnectPositionInput"] | undefined | null
};
	/** A connection to a list of items. */
["UserConnection"]: AliasType<{
	/** Information to aid in pagination. */
	pageInfo?:ResolverInputTypes["PageInfo"],
	/** A list of edges. */
	edges?:ResolverInputTypes["UserEdge"],
	aggregate?:ResolverInputTypes["Aggregate"],
		__typename?: boolean | `@${string}`
}>;
	["UserCreateManyInlineInput"]: {
	/** Connect multiple existing User documents */
	connect?: Array<ResolverInputTypes["UserWhereUniqueInput"]> | undefined | null
};
	["UserCreateOneInlineInput"]: {
	/** Connect one existing User document */
	connect?: ResolverInputTypes["UserWhereUniqueInput"] | undefined | null
};
	/** An edge in a connection. */
["UserEdge"]: AliasType<{
	/** The item at the end of the edge. */
	node?:ResolverInputTypes["User"],
	/** A cursor for use in pagination. */
	cursor?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** System User Kind */
["UserKind"]:UserKind;
	/** Identifies documents */
["UserManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["UserWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["UserWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["UserWhereInput"]> | undefined | null,
	isActive?: boolean | undefined | null,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined | null,
	picture?: string | undefined | null,
	/** All values that are not equal to given value. */
	picture_not?: string | undefined | null,
	/** All values that are contained in given list. */
	picture_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	picture_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	picture_contains?: string | undefined | null,
	/** All values not containing the given string. */
	picture_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	picture_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	picture_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	picture_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	picture_not_ends_with?: string | undefined | null,
	name?: string | undefined | null,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	name_contains?: string | undefined | null,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	kind?: ResolverInputTypes["UserKind"] | undefined | null,
	/** All values that are not equal to given value. */
	kind_not?: ResolverInputTypes["UserKind"] | undefined | null,
	/** All values that are contained in given list. */
	kind_in?: Array<ResolverInputTypes["UserKind"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	kind_not_in?: Array<ResolverInputTypes["UserKind"] | undefined | null> | undefined | null
};
	["UserOrderByInput"]:UserOrderByInput;
	["UserUpdateManyInlineInput"]: {
	/** Connect multiple existing User documents */
	connect?: Array<ResolverInputTypes["UserConnectInput"]> | undefined | null,
	/** Override currently-connected documents with multiple existing User documents */
	set?: Array<ResolverInputTypes["UserWhereUniqueInput"]> | undefined | null,
	/** Disconnect multiple User documents */
	disconnect?: Array<ResolverInputTypes["UserWhereUniqueInput"]> | undefined | null
};
	["UserUpdateOneInlineInput"]: {
	/** Connect existing User document */
	connect?: ResolverInputTypes["UserWhereUniqueInput"] | undefined | null,
	/** Disconnect currently connected User document */
	disconnect?: boolean | undefined | null
};
	/** Identifies documents */
["UserWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined | null,
	/** Logical AND on all given filters. */
	AND?: Array<ResolverInputTypes["UserWhereInput"]> | undefined | null,
	/** Logical OR on all given filters. */
	OR?: Array<ResolverInputTypes["UserWhereInput"]> | undefined | null,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ResolverInputTypes["UserWhereInput"]> | undefined | null,
	isActive?: boolean | undefined | null,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined | null,
	picture?: string | undefined | null,
	/** All values that are not equal to given value. */
	picture_not?: string | undefined | null,
	/** All values that are contained in given list. */
	picture_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	picture_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	picture_contains?: string | undefined | null,
	/** All values not containing the given string. */
	picture_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	picture_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	picture_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	picture_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	picture_not_ends_with?: string | undefined | null,
	name?: string | undefined | null,
	/** All values that are not equal to given value. */
	name_not?: string | undefined | null,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	name_contains?: string | undefined | null,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined | null,
	publishedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	publishedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	publishedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	publishedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	updatedAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	updatedAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	updatedAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	updatedAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	createdAt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are not equal to given value. */
	createdAt_not?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ResolverInputTypes["DateTime"] | undefined | null> | undefined | null,
	/** All values less than the given value. */
	createdAt_lt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values less than or equal the given value. */
	createdAt_lte?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than the given value. */
	createdAt_gt?: ResolverInputTypes["DateTime"] | undefined | null,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ResolverInputTypes["DateTime"] | undefined | null,
	id?: string | undefined | null,
	/** All values that are not equal to given value. */
	id_not?: string | undefined | null,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined | null> | undefined | null,
	/** All values containing the given string. */
	id_contains?: string | undefined | null,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined | null,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined | null,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined | null,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined | null,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined | null,
	kind?: ResolverInputTypes["UserKind"] | undefined | null,
	/** All values that are not equal to given value. */
	kind_not?: ResolverInputTypes["UserKind"] | undefined | null,
	/** All values that are contained in given list. */
	kind_in?: Array<ResolverInputTypes["UserKind"] | undefined | null> | undefined | null,
	/** All values that are not contained in given list. */
	kind_not_in?: Array<ResolverInputTypes["UserKind"] | undefined | null> | undefined | null
};
	/** References User record uniquely */
["UserWhereUniqueInput"]: {
	id?: string | undefined | null
};
	["Version"]: AliasType<{
	id?:boolean | `@${string}`,
	stage?:boolean | `@${string}`,
	revision?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["VersionWhereInput"]: {
	id: string,
	stage: ResolverInputTypes["Stage"],
	revision: number
};
	["_FilterKind"]:_FilterKind;
	["_MutationInputFieldKind"]:_MutationInputFieldKind;
	["_MutationKind"]:_MutationKind;
	["_OrderDirection"]:_OrderDirection;
	["_RelationInputCardinality"]:_RelationInputCardinality;
	["_RelationInputKind"]:_RelationInputKind;
	["_RelationKind"]:_RelationKind;
	["_SystemDateTimeFieldVariation"]:_SystemDateTimeFieldVariation
  }

export type ModelTypes = {
    ["Aggregate"]: {
		count: number
};
	/** Asset system model */
["Asset"]: {
		/** System stage field */
	stage: ModelTypes["Stage"],
	/** System Locale field */
	locale: ModelTypes["Locale"],
	/** Get the other localizations for this document */
	localizations: Array<ModelTypes["Asset"]>,
	/** Get the document in other stages */
	documentInStages: Array<ModelTypes["Asset"]>,
	/** The mime type of the file */
	mimeType?: string | undefined,
	/** The file size */
	size?: number | undefined,
	/** The file width */
	width?: number | undefined,
	/** The height of the file */
	height?: number | undefined,
	/** The file name */
	fileName: string,
	/** The file handle */
	handle: string,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: ModelTypes["DateTime"],
	/** The time the document was created */
	createdAt: ModelTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** User that last published this document */
	publishedBy?: ModelTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: ModelTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: ModelTypes["User"] | undefined,
	imageProject: Array<ModelTypes["Project"]>,
	imageSocial: Array<ModelTypes["Social"]>,
	imagePageMetadata: Array<ModelTypes["PageMetadata"]>,
	iconSkill: Array<ModelTypes["Skill"]>,
	scheduledIn: Array<ModelTypes["ScheduledOperation"]>,
	/** List of Asset versions */
	history: Array<ModelTypes["Version"]>,
	/** Get the url for the asset with provided transformations applied. */
	url: string
};
	["AssetConnectInput"]: {
	/** Document to connect */
	where: ModelTypes["AssetWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ModelTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["AssetConnection"]: {
		/** Information to aid in pagination. */
	pageInfo: ModelTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<ModelTypes["AssetEdge"]>,
	aggregate: ModelTypes["Aggregate"]
};
	["AssetCreateInput"]: {
	mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName: string,
	handle: string,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	imageProject?: ModelTypes["ProjectCreateManyInlineInput"] | undefined,
	imageSocial?: ModelTypes["SocialCreateManyInlineInput"] | undefined,
	imagePageMetadata?: ModelTypes["PageMetadataCreateManyInlineInput"] | undefined,
	iconSkill?: ModelTypes["SkillCreateManyInlineInput"] | undefined,
	/** Inline mutations for managing document localizations excluding the default locale */
	localizations?: ModelTypes["AssetCreateLocalizationsInput"] | undefined
};
	["AssetCreateLocalizationDataInput"]: {
	mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName: string,
	handle: string,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined
};
	["AssetCreateLocalizationInput"]: {
	/** Localization input */
	data: ModelTypes["AssetCreateLocalizationDataInput"],
	locale: ModelTypes["Locale"]
};
	["AssetCreateLocalizationsInput"]: {
	/** Create localizations for the newly-created document */
	create?: Array<ModelTypes["AssetCreateLocalizationInput"]> | undefined
};
	["AssetCreateManyInlineInput"]: {
	/** Create and connect multiple existing Asset documents */
	create?: Array<ModelTypes["AssetCreateInput"]> | undefined,
	/** Connect multiple existing Asset documents */
	connect?: Array<ModelTypes["AssetWhereUniqueInput"]> | undefined
};
	["AssetCreateOneInlineInput"]: {
	/** Create and connect one Asset document */
	create?: ModelTypes["AssetCreateInput"] | undefined,
	/** Connect one existing Asset document */
	connect?: ModelTypes["AssetWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["AssetEdge"]: {
		/** The item at the end of the edge. */
	node: ModelTypes["Asset"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["AssetManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["AssetWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["AssetWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["AssetWhereInput"]> | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	imageProject_every?: ModelTypes["ProjectWhereInput"] | undefined,
	imageProject_some?: ModelTypes["ProjectWhereInput"] | undefined,
	imageProject_none?: ModelTypes["ProjectWhereInput"] | undefined,
	imageSocial_every?: ModelTypes["SocialWhereInput"] | undefined,
	imageSocial_some?: ModelTypes["SocialWhereInput"] | undefined,
	imageSocial_none?: ModelTypes["SocialWhereInput"] | undefined,
	imagePageMetadata_every?: ModelTypes["PageMetadataWhereInput"] | undefined,
	imagePageMetadata_some?: ModelTypes["PageMetadataWhereInput"] | undefined,
	imagePageMetadata_none?: ModelTypes["PageMetadataWhereInput"] | undefined,
	iconSkill_every?: ModelTypes["SkillWhereInput"] | undefined,
	iconSkill_some?: ModelTypes["SkillWhereInput"] | undefined,
	iconSkill_none?: ModelTypes["SkillWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	["AssetOrderByInput"]:AssetOrderByInput;
	/** Transformations for Assets */
["AssetTransformationInput"]: {
	image?: ModelTypes["ImageTransformationInput"] | undefined,
	document?: ModelTypes["DocumentTransformationInput"] | undefined,
	/** Pass true if you want to validate the passed transformation parameters */
	validateOptions?: boolean | undefined
};
	["AssetUpdateInput"]: {
	mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName?: string | undefined,
	handle?: string | undefined,
	imageProject?: ModelTypes["ProjectUpdateManyInlineInput"] | undefined,
	imageSocial?: ModelTypes["SocialUpdateManyInlineInput"] | undefined,
	imagePageMetadata?: ModelTypes["PageMetadataUpdateManyInlineInput"] | undefined,
	iconSkill?: ModelTypes["SkillUpdateManyInlineInput"] | undefined,
	/** Manage document localizations */
	localizations?: ModelTypes["AssetUpdateLocalizationsInput"] | undefined
};
	["AssetUpdateLocalizationDataInput"]: {
	mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName?: string | undefined,
	handle?: string | undefined
};
	["AssetUpdateLocalizationInput"]: {
	data: ModelTypes["AssetUpdateLocalizationDataInput"],
	locale: ModelTypes["Locale"]
};
	["AssetUpdateLocalizationsInput"]: {
	/** Localizations to create */
	create?: Array<ModelTypes["AssetCreateLocalizationInput"]> | undefined,
	/** Localizations to update */
	update?: Array<ModelTypes["AssetUpdateLocalizationInput"]> | undefined,
	upsert?: Array<ModelTypes["AssetUpsertLocalizationInput"]> | undefined,
	/** Localizations to delete */
	delete?: Array<ModelTypes["Locale"]> | undefined
};
	["AssetUpdateManyInlineInput"]: {
	/** Create and connect multiple Asset documents */
	create?: Array<ModelTypes["AssetCreateInput"]> | undefined,
	/** Connect multiple existing Asset documents */
	connect?: Array<ModelTypes["AssetConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing Asset documents */
	set?: Array<ModelTypes["AssetWhereUniqueInput"]> | undefined,
	/** Update multiple Asset documents */
	update?: Array<ModelTypes["AssetUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple Asset documents */
	upsert?: Array<ModelTypes["AssetUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple Asset documents */
	disconnect?: Array<ModelTypes["AssetWhereUniqueInput"]> | undefined,
	/** Delete multiple Asset documents */
	delete?: Array<ModelTypes["AssetWhereUniqueInput"]> | undefined
};
	["AssetUpdateManyInput"]: {
	mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName?: string | undefined,
	/** Optional updates to localizations */
	localizations?: ModelTypes["AssetUpdateManyLocalizationsInput"] | undefined
};
	["AssetUpdateManyLocalizationDataInput"]: {
	mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName?: string | undefined
};
	["AssetUpdateManyLocalizationInput"]: {
	data: ModelTypes["AssetUpdateManyLocalizationDataInput"],
	locale: ModelTypes["Locale"]
};
	["AssetUpdateManyLocalizationsInput"]: {
	/** Localizations to update */
	update?: Array<ModelTypes["AssetUpdateManyLocalizationInput"]> | undefined
};
	["AssetUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ModelTypes["AssetWhereInput"],
	/** Update many input */
	data: ModelTypes["AssetUpdateManyInput"]
};
	["AssetUpdateOneInlineInput"]: {
	/** Create and connect one Asset document */
	create?: ModelTypes["AssetCreateInput"] | undefined,
	/** Update single Asset document */
	update?: ModelTypes["AssetUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single Asset document */
	upsert?: ModelTypes["AssetUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing Asset document */
	connect?: ModelTypes["AssetWhereUniqueInput"] | undefined,
	/** Disconnect currently connected Asset document */
	disconnect?: boolean | undefined,
	/** Delete currently connected Asset document */
	delete?: boolean | undefined
};
	["AssetUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["AssetWhereUniqueInput"],
	/** Document to update */
	data: ModelTypes["AssetUpdateInput"]
};
	["AssetUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ModelTypes["AssetCreateInput"],
	/** Update document if it exists */
	update: ModelTypes["AssetUpdateInput"]
};
	["AssetUpsertLocalizationInput"]: {
	update: ModelTypes["AssetUpdateLocalizationDataInput"],
	create: ModelTypes["AssetCreateLocalizationDataInput"],
	locale: ModelTypes["Locale"]
};
	["AssetUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["AssetWhereUniqueInput"],
	/** Upsert data */
	data: ModelTypes["AssetUpsertInput"]
};
	/** Identifies documents */
["AssetWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["AssetWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["AssetWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["AssetWhereInput"]> | undefined,
	mimeType?: string | undefined,
	/** All values that are not equal to given value. */
	mimeType_not?: string | undefined,
	/** All values that are contained in given list. */
	mimeType_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	mimeType_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	mimeType_contains?: string | undefined,
	/** All values not containing the given string. */
	mimeType_not_contains?: string | undefined,
	/** All values starting with the given string. */
	mimeType_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	mimeType_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	mimeType_ends_with?: string | undefined,
	/** All values not ending with the given string */
	mimeType_not_ends_with?: string | undefined,
	size?: number | undefined,
	/** All values that are not equal to given value. */
	size_not?: number | undefined,
	/** All values that are contained in given list. */
	size_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	size_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	size_lt?: number | undefined,
	/** All values less than or equal the given value. */
	size_lte?: number | undefined,
	/** All values greater than the given value. */
	size_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	size_gte?: number | undefined,
	width?: number | undefined,
	/** All values that are not equal to given value. */
	width_not?: number | undefined,
	/** All values that are contained in given list. */
	width_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	width_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	width_lt?: number | undefined,
	/** All values less than or equal the given value. */
	width_lte?: number | undefined,
	/** All values greater than the given value. */
	width_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	width_gte?: number | undefined,
	height?: number | undefined,
	/** All values that are not equal to given value. */
	height_not?: number | undefined,
	/** All values that are contained in given list. */
	height_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	height_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	height_lt?: number | undefined,
	/** All values less than or equal the given value. */
	height_lte?: number | undefined,
	/** All values greater than the given value. */
	height_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	height_gte?: number | undefined,
	fileName?: string | undefined,
	/** All values that are not equal to given value. */
	fileName_not?: string | undefined,
	/** All values that are contained in given list. */
	fileName_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	fileName_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	fileName_contains?: string | undefined,
	/** All values not containing the given string. */
	fileName_not_contains?: string | undefined,
	/** All values starting with the given string. */
	fileName_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	fileName_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	fileName_ends_with?: string | undefined,
	/** All values not ending with the given string */
	fileName_not_ends_with?: string | undefined,
	handle?: string | undefined,
	/** All values that are not equal to given value. */
	handle_not?: string | undefined,
	/** All values that are contained in given list. */
	handle_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	handle_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	handle_contains?: string | undefined,
	/** All values not containing the given string. */
	handle_not_contains?: string | undefined,
	/** All values starting with the given string. */
	handle_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	handle_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	handle_ends_with?: string | undefined,
	/** All values not ending with the given string */
	handle_not_ends_with?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	imageProject_every?: ModelTypes["ProjectWhereInput"] | undefined,
	imageProject_some?: ModelTypes["ProjectWhereInput"] | undefined,
	imageProject_none?: ModelTypes["ProjectWhereInput"] | undefined,
	imageSocial_every?: ModelTypes["SocialWhereInput"] | undefined,
	imageSocial_some?: ModelTypes["SocialWhereInput"] | undefined,
	imageSocial_none?: ModelTypes["SocialWhereInput"] | undefined,
	imagePageMetadata_every?: ModelTypes["PageMetadataWhereInput"] | undefined,
	imagePageMetadata_some?: ModelTypes["PageMetadataWhereInput"] | undefined,
	imagePageMetadata_none?: ModelTypes["PageMetadataWhereInput"] | undefined,
	iconSkill_every?: ModelTypes["SkillWhereInput"] | undefined,
	iconSkill_some?: ModelTypes["SkillWhereInput"] | undefined,
	iconSkill_none?: ModelTypes["SkillWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References Asset record uniquely */
["AssetWhereUniqueInput"]: {
	id?: string | undefined
};
	["BatchPayload"]: {
		/** The number of nodes that have been affected by the Batch operation. */
	count: ModelTypes["Long"]
};
	/** Representing a color value comprising of HEX, RGBA and css color values */
["Color"]: {
		hex: ModelTypes["Hex"],
	rgba: ModelTypes["RGBA"],
	css: string
};
	/** Accepts either HEX or RGBA color value. At least one of hex or rgba value should be passed. If both are passed RGBA is used. */
["ColorInput"]: {
	hex?: ModelTypes["Hex"] | undefined,
	rgba?: ModelTypes["RGBAInput"] | undefined
};
	["ConnectPositionInput"]: {
	/** Connect document after specified document */
	after?: string | undefined,
	/** Connect document before specified document */
	before?: string | undefined,
	/** Connect document at first position */
	start?: boolean | undefined,
	/** Connect document at last position */
	end?: boolean | undefined
};
	/** A date string, such as 2007-12-03 (YYYY-MM-DD), compliant with ISO 8601 standard for representation of dates using the Gregorian calendar. */
["Date"]:any;
	/** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the date-timeformat outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representationof dates and times using the Gregorian calendar. */
["DateTime"]:any;
	["DocumentFileTypes"]:DocumentFileTypes;
	["DocumentOutputInput"]: {
	/** Transforms a document into a desired file type.
See this matrix for format support:

PDF:	jpg, odp, ods, odt, png, svg, txt, and webp
DOC:	docx, html, jpg, odt, pdf, png, svg, txt, and webp
DOCX:	doc, html, jpg, odt, pdf, png, svg, txt, and webp
ODT:	doc, docx, html, jpg, pdf, png, svg, txt, and webp
XLS:	jpg, pdf, ods, png, svg, xlsx, and webp
XLSX:	jpg, pdf, ods, png, svg, xls, and webp
ODS:	jpg, pdf, png, xls, svg, xlsx, and webp
PPT:	jpg, odp, pdf, png, svg, pptx, and webp
PPTX:	jpg, odp, pdf, png, svg, ppt, and webp
ODP:	jpg, pdf, png, ppt, svg, pptx, and webp
BMP:	jpg, odp, ods, odt, pdf, png, svg, and webp
GIF:	jpg, odp, ods, odt, pdf, png, svg, and webp
JPG:	jpg, odp, ods, odt, pdf, png, svg, and webp
PNG:	jpg, odp, ods, odt, pdf, png, svg, and webp
WEBP:	jpg, odp, ods, odt, pdf, png, svg, and webp
TIFF:	jpg, odp, ods, odt, pdf, png, svg, and webp
AI:	    jpg, odp, ods, odt, pdf, png, svg, and webp
PSD:	jpg, odp, ods, odt, pdf, png, svg, and webp
SVG:	jpg, odp, ods, odt, pdf, png, and webp
HTML:	jpg, odt, pdf, svg, txt, and webp
TXT:	jpg, html, odt, pdf, svg, and webp */
	format?: ModelTypes["DocumentFileTypes"] | undefined
};
	/** Transformations for Documents */
["DocumentTransformationInput"]: {
	/** Changes the output for the file. */
	output?: ModelTypes["DocumentOutputInput"] | undefined
};
	["DocumentVersion"]: {
		id: string,
	stage: ModelTypes["Stage"],
	revision: number,
	createdAt: ModelTypes["DateTime"],
	data?: ModelTypes["Json"] | undefined
};
	["Hex"]:any;
	["ImageFit"]:ImageFit;
	["ImageResizeInput"]: {
	/** The width in pixels to resize the image to. The value must be an integer from 1 to 10000. */
	width?: number | undefined,
	/** The height in pixels to resize the image to. The value must be an integer from 1 to 10000. */
	height?: number | undefined,
	/** The default value for the fit parameter is fit:clip. */
	fit?: ModelTypes["ImageFit"] | undefined
};
	/** Transformations for Images */
["ImageTransformationInput"]: {
	/** Resizes the image */
	resize?: ModelTypes["ImageResizeInput"] | undefined
};
	/** Raw JSON value */
["Json"]:any;
	["Locale"]:Locale;
	/** Representing a geolocation point with latitude and longitude */
["Location"]: {
		latitude: number,
	longitude: number,
	distance: number
};
	/** Input for a geolocation point with latitude and longitude */
["LocationInput"]: {
	latitude: number,
	longitude: number
};
	/** The Long scalar type represents non-fractional signed whole numeric values. Long can represent values between -(2^63) and 2^63 - 1. */
["Long"]:any;
	["Mutation"]: {
		/** Create one asset */
	createAsset?: ModelTypes["Asset"] | undefined,
	/** Update one asset */
	updateAsset?: ModelTypes["Asset"] | undefined,
	/** Delete one asset from _all_ existing stages. Returns deleted document. */
	deleteAsset?: ModelTypes["Asset"] | undefined,
	/** Upsert one asset */
	upsertAsset?: ModelTypes["Asset"] | undefined,
	/** Publish one asset */
	publishAsset?: ModelTypes["Asset"] | undefined,
	/** Unpublish one asset from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishAsset?: ModelTypes["Asset"] | undefined,
	/** Update many Asset documents */
	updateManyAssetsConnection: ModelTypes["AssetConnection"],
	/** Delete many Asset documents, return deleted documents */
	deleteManyAssetsConnection: ModelTypes["AssetConnection"],
	/** Publish many Asset documents */
	publishManyAssetsConnection: ModelTypes["AssetConnection"],
	/** Find many Asset documents that match criteria in specified stage and unpublish from target stages */
	unpublishManyAssetsConnection: ModelTypes["AssetConnection"],
	/** Update many assets */
	updateManyAssets: ModelTypes["BatchPayload"],
	/** Delete many Asset documents */
	deleteManyAssets: ModelTypes["BatchPayload"],
	/** Publish many Asset documents */
	publishManyAssets: ModelTypes["BatchPayload"],
	/** Unpublish many Asset documents */
	unpublishManyAssets: ModelTypes["BatchPayload"],
	/** Schedule to publish one asset */
	schedulePublishAsset?: ModelTypes["Asset"] | undefined,
	/** Unpublish one asset from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishAsset?: ModelTypes["Asset"] | undefined,
	/** Delete and return scheduled operation */
	deleteScheduledOperation?: ModelTypes["ScheduledOperation"] | undefined,
	/** Create one scheduledRelease */
	createScheduledRelease?: ModelTypes["ScheduledRelease"] | undefined,
	/** Update one scheduledRelease */
	updateScheduledRelease?: ModelTypes["ScheduledRelease"] | undefined,
	/** Delete one scheduledRelease from _all_ existing stages. Returns deleted document. */
	deleteScheduledRelease?: ModelTypes["ScheduledRelease"] | undefined,
	/** Create one project */
	createProject?: ModelTypes["Project"] | undefined,
	/** Update one project */
	updateProject?: ModelTypes["Project"] | undefined,
	/** Delete one project from _all_ existing stages. Returns deleted document. */
	deleteProject?: ModelTypes["Project"] | undefined,
	/** Upsert one project */
	upsertProject?: ModelTypes["Project"] | undefined,
	/** Publish one project */
	publishProject?: ModelTypes["Project"] | undefined,
	/** Unpublish one project from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishProject?: ModelTypes["Project"] | undefined,
	/** Update many Project documents */
	updateManyProjectsConnection: ModelTypes["ProjectConnection"],
	/** Delete many Project documents, return deleted documents */
	deleteManyProjectsConnection: ModelTypes["ProjectConnection"],
	/** Publish many Project documents */
	publishManyProjectsConnection: ModelTypes["ProjectConnection"],
	/** Find many Project documents that match criteria in specified stage and unpublish from target stages */
	unpublishManyProjectsConnection: ModelTypes["ProjectConnection"],
	/** Update many projects */
	updateManyProjects: ModelTypes["BatchPayload"],
	/** Delete many Project documents */
	deleteManyProjects: ModelTypes["BatchPayload"],
	/** Publish many Project documents */
	publishManyProjects: ModelTypes["BatchPayload"],
	/** Unpublish many Project documents */
	unpublishManyProjects: ModelTypes["BatchPayload"],
	/** Schedule to publish one project */
	schedulePublishProject?: ModelTypes["Project"] | undefined,
	/** Unpublish one project from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishProject?: ModelTypes["Project"] | undefined,
	/** Create one social */
	createSocial?: ModelTypes["Social"] | undefined,
	/** Update one social */
	updateSocial?: ModelTypes["Social"] | undefined,
	/** Delete one social from _all_ existing stages. Returns deleted document. */
	deleteSocial?: ModelTypes["Social"] | undefined,
	/** Upsert one social */
	upsertSocial?: ModelTypes["Social"] | undefined,
	/** Publish one social */
	publishSocial?: ModelTypes["Social"] | undefined,
	/** Unpublish one social from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishSocial?: ModelTypes["Social"] | undefined,
	/** Update many Social documents */
	updateManySocialsConnection: ModelTypes["SocialConnection"],
	/** Delete many Social documents, return deleted documents */
	deleteManySocialsConnection: ModelTypes["SocialConnection"],
	/** Publish many Social documents */
	publishManySocialsConnection: ModelTypes["SocialConnection"],
	/** Find many Social documents that match criteria in specified stage and unpublish from target stages */
	unpublishManySocialsConnection: ModelTypes["SocialConnection"],
	/** Update many socials */
	updateManySocials: ModelTypes["BatchPayload"],
	/** Delete many Social documents */
	deleteManySocials: ModelTypes["BatchPayload"],
	/** Publish many Social documents */
	publishManySocials: ModelTypes["BatchPayload"],
	/** Unpublish many Social documents */
	unpublishManySocials: ModelTypes["BatchPayload"],
	/** Schedule to publish one social */
	schedulePublishSocial?: ModelTypes["Social"] | undefined,
	/** Unpublish one social from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishSocial?: ModelTypes["Social"] | undefined,
	/** Create one pageMetadata */
	createPageMetadata?: ModelTypes["PageMetadata"] | undefined,
	/** Update one pageMetadata */
	updatePageMetadata?: ModelTypes["PageMetadata"] | undefined,
	/** Delete one pageMetadata from _all_ existing stages. Returns deleted document. */
	deletePageMetadata?: ModelTypes["PageMetadata"] | undefined,
	/** Upsert one pageMetadata */
	upsertPageMetadata?: ModelTypes["PageMetadata"] | undefined,
	/** Publish one pageMetadata */
	publishPageMetadata?: ModelTypes["PageMetadata"] | undefined,
	/** Unpublish one pageMetadata from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishPageMetadata?: ModelTypes["PageMetadata"] | undefined,
	/** Update many PageMetadata documents */
	updateManyPagesMetadataConnection: ModelTypes["PageMetadataConnection"],
	/** Delete many PageMetadata documents, return deleted documents */
	deleteManyPagesMetadataConnection: ModelTypes["PageMetadataConnection"],
	/** Publish many PageMetadata documents */
	publishManyPagesMetadataConnection: ModelTypes["PageMetadataConnection"],
	/** Find many PageMetadata documents that match criteria in specified stage and unpublish from target stages */
	unpublishManyPagesMetadataConnection: ModelTypes["PageMetadataConnection"],
	/** Update many pagesMetadata */
	updateManyPagesMetadata: ModelTypes["BatchPayload"],
	/** Delete many PageMetadata documents */
	deleteManyPagesMetadata: ModelTypes["BatchPayload"],
	/** Publish many PageMetadata documents */
	publishManyPagesMetadata: ModelTypes["BatchPayload"],
	/** Unpublish many PageMetadata documents */
	unpublishManyPagesMetadata: ModelTypes["BatchPayload"],
	/** Schedule to publish one pageMetadata */
	schedulePublishPageMetadata?: ModelTypes["PageMetadata"] | undefined,
	/** Unpublish one pageMetadata from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishPageMetadata?: ModelTypes["PageMetadata"] | undefined,
	/** Create one skill */
	createSkill?: ModelTypes["Skill"] | undefined,
	/** Update one skill */
	updateSkill?: ModelTypes["Skill"] | undefined,
	/** Delete one skill from _all_ existing stages. Returns deleted document. */
	deleteSkill?: ModelTypes["Skill"] | undefined,
	/** Upsert one skill */
	upsertSkill?: ModelTypes["Skill"] | undefined,
	/** Publish one skill */
	publishSkill?: ModelTypes["Skill"] | undefined,
	/** Unpublish one skill from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishSkill?: ModelTypes["Skill"] | undefined,
	/** Update many Skill documents */
	updateManySkillsConnection: ModelTypes["SkillConnection"],
	/** Delete many Skill documents, return deleted documents */
	deleteManySkillsConnection: ModelTypes["SkillConnection"],
	/** Publish many Skill documents */
	publishManySkillsConnection: ModelTypes["SkillConnection"],
	/** Find many Skill documents that match criteria in specified stage and unpublish from target stages */
	unpublishManySkillsConnection: ModelTypes["SkillConnection"],
	/** Update many skills */
	updateManySkills: ModelTypes["BatchPayload"],
	/** Delete many Skill documents */
	deleteManySkills: ModelTypes["BatchPayload"],
	/** Publish many Skill documents */
	publishManySkills: ModelTypes["BatchPayload"],
	/** Unpublish many Skill documents */
	unpublishManySkills: ModelTypes["BatchPayload"],
	/** Schedule to publish one skill */
	schedulePublishSkill?: ModelTypes["Skill"] | undefined,
	/** Unpublish one skill from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishSkill?: ModelTypes["Skill"] | undefined
};
	/** An object with an ID */
["Node"]: ModelTypes["Asset"] | ModelTypes["PageMetadata"] | ModelTypes["Project"] | ModelTypes["ScheduledOperation"] | ModelTypes["ScheduledRelease"] | ModelTypes["Skill"] | ModelTypes["Social"] | ModelTypes["User"];
	/** Information about pagination in a connection. */
["PageInfo"]: {
		/** When paginating forwards, are there more items? */
	hasNextPage: boolean,
	/** When paginating backwards, are there more items? */
	hasPreviousPage: boolean,
	/** When paginating backwards, the cursor to continue. */
	startCursor?: string | undefined,
	/** When paginating forwards, the cursor to continue. */
	endCursor?: string | undefined,
	/** Number of items in the current page. */
	pageSize?: number | undefined
};
	/** Page Metadata */
["PageMetadata"]: {
		/** System stage field */
	stage: ModelTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<ModelTypes["PageMetadata"]>,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: ModelTypes["DateTime"],
	/** The time the document was created */
	createdAt: ModelTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** Page title */
	title: string,
	/** Page content summary */
	summary: string,
	/** Page slug */
	slug?: string | undefined,
	/** Page number */
	pageNumber: number,
	/** User that last published this document */
	publishedBy?: ModelTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: ModelTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: ModelTypes["User"] | undefined,
	/** Page image */
	image?: ModelTypes["Asset"] | undefined,
	scheduledIn: Array<ModelTypes["ScheduledOperation"]>,
	/** List of PageMetadata versions */
	history: Array<ModelTypes["Version"]>
};
	["PageMetadataConnectInput"]: {
	/** Document to connect */
	where: ModelTypes["PageMetadataWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ModelTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["PageMetadataConnection"]: {
		/** Information to aid in pagination. */
	pageInfo: ModelTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<ModelTypes["PageMetadataEdge"]>,
	aggregate: ModelTypes["Aggregate"]
};
	["PageMetadataCreateInput"]: {
	updatedAt?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	title: string,
	summary: string,
	slug?: string | undefined,
	pageNumber: number,
	image?: ModelTypes["AssetCreateOneInlineInput"] | undefined
};
	["PageMetadataCreateManyInlineInput"]: {
	/** Create and connect multiple existing PageMetadata documents */
	create?: Array<ModelTypes["PageMetadataCreateInput"]> | undefined,
	/** Connect multiple existing PageMetadata documents */
	connect?: Array<ModelTypes["PageMetadataWhereUniqueInput"]> | undefined
};
	["PageMetadataCreateOneInlineInput"]: {
	/** Create and connect one PageMetadata document */
	create?: ModelTypes["PageMetadataCreateInput"] | undefined,
	/** Connect one existing PageMetadata document */
	connect?: ModelTypes["PageMetadataWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["PageMetadataEdge"]: {
		/** The item at the end of the edge. */
	node: ModelTypes["PageMetadata"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["PageMetadataManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["PageMetadataWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["PageMetadataWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["PageMetadataWhereInput"]> | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	title?: string | undefined,
	/** All values that are not equal to given value. */
	title_not?: string | undefined,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	title_contains?: string | undefined,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined,
	summary?: string | undefined,
	/** All values that are not equal to given value. */
	summary_not?: string | undefined,
	/** All values that are contained in given list. */
	summary_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	summary_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	summary_contains?: string | undefined,
	/** All values not containing the given string. */
	summary_not_contains?: string | undefined,
	/** All values starting with the given string. */
	summary_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	summary_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	summary_ends_with?: string | undefined,
	/** All values not ending with the given string */
	summary_not_ends_with?: string | undefined,
	slug?: string | undefined,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	slug_contains?: string | undefined,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined,
	pageNumber?: number | undefined,
	/** All values that are not equal to given value. */
	pageNumber_not?: number | undefined,
	/** All values that are contained in given list. */
	pageNumber_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	pageNumber_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	pageNumber_lt?: number | undefined,
	/** All values less than or equal the given value. */
	pageNumber_lte?: number | undefined,
	/** All values greater than the given value. */
	pageNumber_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	pageNumber_gte?: number | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	image?: ModelTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	["PageMetadataOrderByInput"]:PageMetadataOrderByInput;
	["PageMetadataUpdateInput"]: {
	title?: string | undefined,
	summary?: string | undefined,
	slug?: string | undefined,
	pageNumber?: number | undefined,
	image?: ModelTypes["AssetUpdateOneInlineInput"] | undefined
};
	["PageMetadataUpdateManyInlineInput"]: {
	/** Create and connect multiple PageMetadata documents */
	create?: Array<ModelTypes["PageMetadataCreateInput"]> | undefined,
	/** Connect multiple existing PageMetadata documents */
	connect?: Array<ModelTypes["PageMetadataConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing PageMetadata documents */
	set?: Array<ModelTypes["PageMetadataWhereUniqueInput"]> | undefined,
	/** Update multiple PageMetadata documents */
	update?: Array<ModelTypes["PageMetadataUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple PageMetadata documents */
	upsert?: Array<ModelTypes["PageMetadataUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple PageMetadata documents */
	disconnect?: Array<ModelTypes["PageMetadataWhereUniqueInput"]> | undefined,
	/** Delete multiple PageMetadata documents */
	delete?: Array<ModelTypes["PageMetadataWhereUniqueInput"]> | undefined
};
	["PageMetadataUpdateManyInput"]: {
	summary?: string | undefined,
	pageNumber?: number | undefined
};
	["PageMetadataUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ModelTypes["PageMetadataWhereInput"],
	/** Update many input */
	data: ModelTypes["PageMetadataUpdateManyInput"]
};
	["PageMetadataUpdateOneInlineInput"]: {
	/** Create and connect one PageMetadata document */
	create?: ModelTypes["PageMetadataCreateInput"] | undefined,
	/** Update single PageMetadata document */
	update?: ModelTypes["PageMetadataUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single PageMetadata document */
	upsert?: ModelTypes["PageMetadataUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing PageMetadata document */
	connect?: ModelTypes["PageMetadataWhereUniqueInput"] | undefined,
	/** Disconnect currently connected PageMetadata document */
	disconnect?: boolean | undefined,
	/** Delete currently connected PageMetadata document */
	delete?: boolean | undefined
};
	["PageMetadataUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["PageMetadataWhereUniqueInput"],
	/** Document to update */
	data: ModelTypes["PageMetadataUpdateInput"]
};
	["PageMetadataUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ModelTypes["PageMetadataCreateInput"],
	/** Update document if it exists */
	update: ModelTypes["PageMetadataUpdateInput"]
};
	["PageMetadataUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["PageMetadataWhereUniqueInput"],
	/** Upsert data */
	data: ModelTypes["PageMetadataUpsertInput"]
};
	/** Identifies documents */
["PageMetadataWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["PageMetadataWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["PageMetadataWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["PageMetadataWhereInput"]> | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	title?: string | undefined,
	/** All values that are not equal to given value. */
	title_not?: string | undefined,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	title_contains?: string | undefined,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined,
	summary?: string | undefined,
	/** All values that are not equal to given value. */
	summary_not?: string | undefined,
	/** All values that are contained in given list. */
	summary_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	summary_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	summary_contains?: string | undefined,
	/** All values not containing the given string. */
	summary_not_contains?: string | undefined,
	/** All values starting with the given string. */
	summary_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	summary_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	summary_ends_with?: string | undefined,
	/** All values not ending with the given string */
	summary_not_ends_with?: string | undefined,
	slug?: string | undefined,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	slug_contains?: string | undefined,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined,
	pageNumber?: number | undefined,
	/** All values that are not equal to given value. */
	pageNumber_not?: number | undefined,
	/** All values that are contained in given list. */
	pageNumber_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	pageNumber_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	pageNumber_lt?: number | undefined,
	/** All values less than or equal the given value. */
	pageNumber_lte?: number | undefined,
	/** All values greater than the given value. */
	pageNumber_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	pageNumber_gte?: number | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	image?: ModelTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References PageMetadata record uniquely */
["PageMetadataWhereUniqueInput"]: {
	id?: string | undefined,
	title?: string | undefined,
	slug?: string | undefined
};
	["Project"]: {
		/** System stage field */
	stage: ModelTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<ModelTypes["Project"]>,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: ModelTypes["DateTime"],
	/** The time the document was created */
	createdAt: ModelTypes["DateTime"],
	/** The unique identifier */
	id: string,
	name: string,
	slug?: string | undefined,
	description: string,
	tags: Array<string>,
	demo?: string | undefined,
	sourceCode?: string | undefined,
	/** User that last published this document */
	publishedBy?: ModelTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: ModelTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: ModelTypes["User"] | undefined,
	/** Add one or more images of the project  */
	image: Array<ModelTypes["Asset"]>,
	scheduledIn: Array<ModelTypes["ScheduledOperation"]>,
	/** List of Project versions */
	history: Array<ModelTypes["Version"]>
};
	["ProjectConnectInput"]: {
	/** Document to connect */
	where: ModelTypes["ProjectWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ModelTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["ProjectConnection"]: {
		/** Information to aid in pagination. */
	pageInfo: ModelTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<ModelTypes["ProjectEdge"]>,
	aggregate: ModelTypes["Aggregate"]
};
	["ProjectCreateInput"]: {
	updatedAt?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	name: string,
	slug?: string | undefined,
	description: string,
	tags?: Array<string> | undefined,
	demo?: string | undefined,
	sourceCode?: string | undefined,
	image: ModelTypes["AssetCreateManyInlineInput"]
};
	["ProjectCreateManyInlineInput"]: {
	/** Create and connect multiple existing Project documents */
	create?: Array<ModelTypes["ProjectCreateInput"]> | undefined,
	/** Connect multiple existing Project documents */
	connect?: Array<ModelTypes["ProjectWhereUniqueInput"]> | undefined
};
	["ProjectCreateOneInlineInput"]: {
	/** Create and connect one Project document */
	create?: ModelTypes["ProjectCreateInput"] | undefined,
	/** Connect one existing Project document */
	connect?: ModelTypes["ProjectWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["ProjectEdge"]: {
		/** The item at the end of the edge. */
	node: ModelTypes["Project"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["ProjectManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["ProjectWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["ProjectWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["ProjectWhereInput"]> | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	slug?: string | undefined,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	slug_contains?: string | undefined,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	/** Matches if the field array contains *all* items provided to the filter and order does match */
	tags?: Array<string> | undefined,
	/** Matches if the field array does not contains *all* items provided to the filter or order does not match */
	tags_not?: Array<string> | undefined,
	/** Matches if the field array contains *all* items provided to the filter */
	tags_contains_all?: Array<string> | undefined,
	/** Matches if the field array contains at least one item provided to the filter */
	tags_contains_some?: Array<string> | undefined,
	/** Matches if the field array does not contain any of the items provided to the filter */
	tags_contains_none?: Array<string> | undefined,
	demo?: string | undefined,
	/** All values that are not equal to given value. */
	demo_not?: string | undefined,
	/** All values that are contained in given list. */
	demo_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	demo_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	demo_contains?: string | undefined,
	/** All values not containing the given string. */
	demo_not_contains?: string | undefined,
	/** All values starting with the given string. */
	demo_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	demo_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	demo_ends_with?: string | undefined,
	/** All values not ending with the given string */
	demo_not_ends_with?: string | undefined,
	sourceCode?: string | undefined,
	/** All values that are not equal to given value. */
	sourceCode_not?: string | undefined,
	/** All values that are contained in given list. */
	sourceCode_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	sourceCode_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	sourceCode_contains?: string | undefined,
	/** All values not containing the given string. */
	sourceCode_not_contains?: string | undefined,
	/** All values starting with the given string. */
	sourceCode_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	sourceCode_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	sourceCode_ends_with?: string | undefined,
	/** All values not ending with the given string */
	sourceCode_not_ends_with?: string | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	image_every?: ModelTypes["AssetWhereInput"] | undefined,
	image_some?: ModelTypes["AssetWhereInput"] | undefined,
	image_none?: ModelTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	["ProjectOrderByInput"]:ProjectOrderByInput;
	["ProjectUpdateInput"]: {
	name?: string | undefined,
	slug?: string | undefined,
	description?: string | undefined,
	tags?: Array<string> | undefined,
	demo?: string | undefined,
	sourceCode?: string | undefined,
	image?: ModelTypes["AssetUpdateManyInlineInput"] | undefined
};
	["ProjectUpdateManyInlineInput"]: {
	/** Create and connect multiple Project documents */
	create?: Array<ModelTypes["ProjectCreateInput"]> | undefined,
	/** Connect multiple existing Project documents */
	connect?: Array<ModelTypes["ProjectConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing Project documents */
	set?: Array<ModelTypes["ProjectWhereUniqueInput"]> | undefined,
	/** Update multiple Project documents */
	update?: Array<ModelTypes["ProjectUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple Project documents */
	upsert?: Array<ModelTypes["ProjectUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple Project documents */
	disconnect?: Array<ModelTypes["ProjectWhereUniqueInput"]> | undefined,
	/** Delete multiple Project documents */
	delete?: Array<ModelTypes["ProjectWhereUniqueInput"]> | undefined
};
	["ProjectUpdateManyInput"]: {
	description?: string | undefined,
	tags?: Array<string> | undefined,
	demo?: string | undefined,
	sourceCode?: string | undefined
};
	["ProjectUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ModelTypes["ProjectWhereInput"],
	/** Update many input */
	data: ModelTypes["ProjectUpdateManyInput"]
};
	["ProjectUpdateOneInlineInput"]: {
	/** Create and connect one Project document */
	create?: ModelTypes["ProjectCreateInput"] | undefined,
	/** Update single Project document */
	update?: ModelTypes["ProjectUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single Project document */
	upsert?: ModelTypes["ProjectUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing Project document */
	connect?: ModelTypes["ProjectWhereUniqueInput"] | undefined,
	/** Disconnect currently connected Project document */
	disconnect?: boolean | undefined,
	/** Delete currently connected Project document */
	delete?: boolean | undefined
};
	["ProjectUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["ProjectWhereUniqueInput"],
	/** Document to update */
	data: ModelTypes["ProjectUpdateInput"]
};
	["ProjectUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ModelTypes["ProjectCreateInput"],
	/** Update document if it exists */
	update: ModelTypes["ProjectUpdateInput"]
};
	["ProjectUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["ProjectWhereUniqueInput"],
	/** Upsert data */
	data: ModelTypes["ProjectUpsertInput"]
};
	/** Identifies documents */
["ProjectWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["ProjectWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["ProjectWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["ProjectWhereInput"]> | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	slug?: string | undefined,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	slug_contains?: string | undefined,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	/** Matches if the field array contains *all* items provided to the filter and order does match */
	tags?: Array<string> | undefined,
	/** Matches if the field array does not contains *all* items provided to the filter or order does not match */
	tags_not?: Array<string> | undefined,
	/** Matches if the field array contains *all* items provided to the filter */
	tags_contains_all?: Array<string> | undefined,
	/** Matches if the field array contains at least one item provided to the filter */
	tags_contains_some?: Array<string> | undefined,
	/** Matches if the field array does not contain any of the items provided to the filter */
	tags_contains_none?: Array<string> | undefined,
	demo?: string | undefined,
	/** All values that are not equal to given value. */
	demo_not?: string | undefined,
	/** All values that are contained in given list. */
	demo_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	demo_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	demo_contains?: string | undefined,
	/** All values not containing the given string. */
	demo_not_contains?: string | undefined,
	/** All values starting with the given string. */
	demo_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	demo_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	demo_ends_with?: string | undefined,
	/** All values not ending with the given string */
	demo_not_ends_with?: string | undefined,
	sourceCode?: string | undefined,
	/** All values that are not equal to given value. */
	sourceCode_not?: string | undefined,
	/** All values that are contained in given list. */
	sourceCode_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	sourceCode_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	sourceCode_contains?: string | undefined,
	/** All values not containing the given string. */
	sourceCode_not_contains?: string | undefined,
	/** All values starting with the given string. */
	sourceCode_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	sourceCode_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	sourceCode_ends_with?: string | undefined,
	/** All values not ending with the given string */
	sourceCode_not_ends_with?: string | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	image_every?: ModelTypes["AssetWhereInput"] | undefined,
	image_some?: ModelTypes["AssetWhereInput"] | undefined,
	image_none?: ModelTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References Project record uniquely */
["ProjectWhereUniqueInput"]: {
	id?: string | undefined,
	name?: string | undefined,
	slug?: string | undefined
};
	["PublishLocaleInput"]: {
	/** Locales to publish */
	locale: ModelTypes["Locale"],
	/** Stages to publish selected locales to */
	stages: Array<ModelTypes["Stage"]>
};
	["Query"]: {
		/** Fetches an object given its ID */
	node?: ModelTypes["Node"] | undefined,
	/** Retrieve multiple users */
	users: Array<ModelTypes["User"]>,
	/** Retrieve a single user */
	user?: ModelTypes["User"] | undefined,
	/** Retrieve multiple users using the Relay connection interface */
	usersConnection: ModelTypes["UserConnection"],
	/** Retrieve multiple assets */
	assets: Array<ModelTypes["Asset"]>,
	/** Retrieve a single asset */
	asset?: ModelTypes["Asset"] | undefined,
	/** Retrieve multiple assets using the Relay connection interface */
	assetsConnection: ModelTypes["AssetConnection"],
	/** Retrieve document version */
	assetVersion?: ModelTypes["DocumentVersion"] | undefined,
	/** Retrieve multiple scheduledOperations */
	scheduledOperations: Array<ModelTypes["ScheduledOperation"]>,
	/** Retrieve a single scheduledOperation */
	scheduledOperation?: ModelTypes["ScheduledOperation"] | undefined,
	/** Retrieve multiple scheduledOperations using the Relay connection interface */
	scheduledOperationsConnection: ModelTypes["ScheduledOperationConnection"],
	/** Retrieve multiple scheduledReleases */
	scheduledReleases: Array<ModelTypes["ScheduledRelease"]>,
	/** Retrieve a single scheduledRelease */
	scheduledRelease?: ModelTypes["ScheduledRelease"] | undefined,
	/** Retrieve multiple scheduledReleases using the Relay connection interface */
	scheduledReleasesConnection: ModelTypes["ScheduledReleaseConnection"],
	/** Retrieve multiple projects */
	projects: Array<ModelTypes["Project"]>,
	/** Retrieve a single project */
	project?: ModelTypes["Project"] | undefined,
	/** Retrieve multiple projects using the Relay connection interface */
	projectsConnection: ModelTypes["ProjectConnection"],
	/** Retrieve document version */
	projectVersion?: ModelTypes["DocumentVersion"] | undefined,
	/** Retrieve multiple socials */
	socials: Array<ModelTypes["Social"]>,
	/** Retrieve a single social */
	social?: ModelTypes["Social"] | undefined,
	/** Retrieve multiple socials using the Relay connection interface */
	socialsConnection: ModelTypes["SocialConnection"],
	/** Retrieve document version */
	socialVersion?: ModelTypes["DocumentVersion"] | undefined,
	/** Retrieve multiple pagesMetadata */
	pagesMetadata: Array<ModelTypes["PageMetadata"]>,
	/** Retrieve a single pageMetadata */
	pageMetadata?: ModelTypes["PageMetadata"] | undefined,
	/** Retrieve multiple pagesMetadata using the Relay connection interface */
	pagesMetadataConnection: ModelTypes["PageMetadataConnection"],
	/** Retrieve document version */
	pageMetadataVersion?: ModelTypes["DocumentVersion"] | undefined,
	/** Retrieve multiple skills */
	skills: Array<ModelTypes["Skill"]>,
	/** Retrieve a single skill */
	skill?: ModelTypes["Skill"] | undefined,
	/** Retrieve multiple skills using the Relay connection interface */
	skillsConnection: ModelTypes["SkillConnection"],
	/** Retrieve document version */
	skillVersion?: ModelTypes["DocumentVersion"] | undefined
};
	/** Representing a RGBA color value: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba() */
["RGBA"]: {
		r: ModelTypes["RGBAHue"],
	g: ModelTypes["RGBAHue"],
	b: ModelTypes["RGBAHue"],
	a: ModelTypes["RGBATransparency"]
};
	["RGBAHue"]:any;
	/** Input type representing a RGBA color value: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba() */
["RGBAInput"]: {
	r: ModelTypes["RGBAHue"],
	g: ModelTypes["RGBAHue"],
	b: ModelTypes["RGBAHue"],
	a: ModelTypes["RGBATransparency"]
};
	["RGBATransparency"]:any;
	/** Custom type representing a rich text value comprising of raw rich text ast, html, markdown and text values */
["RichText"]: {
		/** Returns AST representation */
	raw: ModelTypes["RichTextAST"],
	/** Returns HTMl representation */
	html: string,
	/** Returns Markdown representation */
	markdown: string,
	/** Returns plain-text contents of RichText */
	text: string
};
	/** Slate-compatible RichText AST */
["RichTextAST"]:any;
	/** Scheduled Operation system model */
["ScheduledOperation"]: {
		/** System stage field */
	stage: ModelTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<ModelTypes["ScheduledOperation"]>,
	/** Raw operation payload including all details, this field is subject to change */
	rawPayload: ModelTypes["Json"],
	/** Operation error message */
	errorMessage?: string | undefined,
	/** Operation description */
	description?: string | undefined,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: ModelTypes["DateTime"],
	/** The time the document was created */
	createdAt: ModelTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** The release this operation is scheduled for */
	release?: ModelTypes["ScheduledRelease"] | undefined,
	/** User that last published this document */
	publishedBy?: ModelTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: ModelTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: ModelTypes["User"] | undefined,
	/** operation Status */
	status: ModelTypes["ScheduledOperationStatus"],
	affectedDocuments: Array<ModelTypes["ScheduledOperationAffectedDocument"]>
};
	["ScheduledOperationAffectedDocument"]:ModelTypes["Asset"] | ModelTypes["PageMetadata"] | ModelTypes["Project"] | ModelTypes["Skill"] | ModelTypes["Social"];
	["ScheduledOperationConnectInput"]: {
	/** Document to connect */
	where: ModelTypes["ScheduledOperationWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ModelTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["ScheduledOperationConnection"]: {
		/** Information to aid in pagination. */
	pageInfo: ModelTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<ModelTypes["ScheduledOperationEdge"]>,
	aggregate: ModelTypes["Aggregate"]
};
	["ScheduledOperationCreateManyInlineInput"]: {
	/** Connect multiple existing ScheduledOperation documents */
	connect?: Array<ModelTypes["ScheduledOperationWhereUniqueInput"]> | undefined
};
	["ScheduledOperationCreateOneInlineInput"]: {
	/** Connect one existing ScheduledOperation document */
	connect?: ModelTypes["ScheduledOperationWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["ScheduledOperationEdge"]: {
		/** The item at the end of the edge. */
	node: ModelTypes["ScheduledOperation"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["ScheduledOperationManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["ScheduledOperationWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["ScheduledOperationWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["ScheduledOperationWhereInput"]> | undefined,
	errorMessage?: string | undefined,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	release?: ModelTypes["ScheduledReleaseWhereInput"] | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	status?: ModelTypes["ScheduledOperationStatus"] | undefined,
	/** All values that are not equal to given value. */
	status_not?: ModelTypes["ScheduledOperationStatus"] | undefined,
	/** All values that are contained in given list. */
	status_in?: Array<ModelTypes["ScheduledOperationStatus"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ModelTypes["ScheduledOperationStatus"] | undefined> | undefined
};
	["ScheduledOperationOrderByInput"]:ScheduledOperationOrderByInput;
	["ScheduledOperationStatus"]:ScheduledOperationStatus;
	["ScheduledOperationUpdateManyInlineInput"]: {
	/** Connect multiple existing ScheduledOperation documents */
	connect?: Array<ModelTypes["ScheduledOperationConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing ScheduledOperation documents */
	set?: Array<ModelTypes["ScheduledOperationWhereUniqueInput"]> | undefined,
	/** Disconnect multiple ScheduledOperation documents */
	disconnect?: Array<ModelTypes["ScheduledOperationWhereUniqueInput"]> | undefined
};
	["ScheduledOperationUpdateOneInlineInput"]: {
	/** Connect existing ScheduledOperation document */
	connect?: ModelTypes["ScheduledOperationWhereUniqueInput"] | undefined,
	/** Disconnect currently connected ScheduledOperation document */
	disconnect?: boolean | undefined
};
	/** Identifies documents */
["ScheduledOperationWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["ScheduledOperationWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["ScheduledOperationWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["ScheduledOperationWhereInput"]> | undefined,
	errorMessage?: string | undefined,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	release?: ModelTypes["ScheduledReleaseWhereInput"] | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	status?: ModelTypes["ScheduledOperationStatus"] | undefined,
	/** All values that are not equal to given value. */
	status_not?: ModelTypes["ScheduledOperationStatus"] | undefined,
	/** All values that are contained in given list. */
	status_in?: Array<ModelTypes["ScheduledOperationStatus"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ModelTypes["ScheduledOperationStatus"] | undefined> | undefined
};
	/** References ScheduledOperation record uniquely */
["ScheduledOperationWhereUniqueInput"]: {
	id?: string | undefined
};
	/** Scheduled Release system model */
["ScheduledRelease"]: {
		/** System stage field */
	stage: ModelTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<ModelTypes["ScheduledRelease"]>,
	/** Release date and time */
	releaseAt?: ModelTypes["DateTime"] | undefined,
	/** Whether scheduled release is implicit */
	isImplicit: boolean,
	/** Whether scheduled release should be run */
	isActive: boolean,
	/** Release error message */
	errorMessage?: string | undefined,
	/** Release description */
	description?: string | undefined,
	/** Release Title */
	title?: string | undefined,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: ModelTypes["DateTime"],
	/** The time the document was created */
	createdAt: ModelTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** Operations to run with this release */
	operations: Array<ModelTypes["ScheduledOperation"]>,
	/** User that last published this document */
	publishedBy?: ModelTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: ModelTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: ModelTypes["User"] | undefined,
	/** Release Status */
	status: ModelTypes["ScheduledReleaseStatus"]
};
	["ScheduledReleaseConnectInput"]: {
	/** Document to connect */
	where: ModelTypes["ScheduledReleaseWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ModelTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["ScheduledReleaseConnection"]: {
		/** Information to aid in pagination. */
	pageInfo: ModelTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<ModelTypes["ScheduledReleaseEdge"]>,
	aggregate: ModelTypes["Aggregate"]
};
	["ScheduledReleaseCreateInput"]: {
	releaseAt?: ModelTypes["DateTime"] | undefined,
	isActive?: boolean | undefined,
	errorMessage?: string | undefined,
	description?: string | undefined,
	title?: string | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined
};
	["ScheduledReleaseCreateManyInlineInput"]: {
	/** Create and connect multiple existing ScheduledRelease documents */
	create?: Array<ModelTypes["ScheduledReleaseCreateInput"]> | undefined,
	/** Connect multiple existing ScheduledRelease documents */
	connect?: Array<ModelTypes["ScheduledReleaseWhereUniqueInput"]> | undefined
};
	["ScheduledReleaseCreateOneInlineInput"]: {
	/** Create and connect one ScheduledRelease document */
	create?: ModelTypes["ScheduledReleaseCreateInput"] | undefined,
	/** Connect one existing ScheduledRelease document */
	connect?: ModelTypes["ScheduledReleaseWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["ScheduledReleaseEdge"]: {
		/** The item at the end of the edge. */
	node: ModelTypes["ScheduledRelease"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["ScheduledReleaseManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["ScheduledReleaseWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["ScheduledReleaseWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["ScheduledReleaseWhereInput"]> | undefined,
	releaseAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	releaseAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	releaseAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	releaseAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	releaseAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	releaseAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	releaseAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	releaseAt_gte?: ModelTypes["DateTime"] | undefined,
	isImplicit?: boolean | undefined,
	/** All values that are not equal to given value. */
	isImplicit_not?: boolean | undefined,
	isActive?: boolean | undefined,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined,
	errorMessage?: string | undefined,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	title?: string | undefined,
	/** All values that are not equal to given value. */
	title_not?: string | undefined,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	title_contains?: string | undefined,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	operations_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	operations_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	operations_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	status?: ModelTypes["ScheduledReleaseStatus"] | undefined,
	/** All values that are not equal to given value. */
	status_not?: ModelTypes["ScheduledReleaseStatus"] | undefined,
	/** All values that are contained in given list. */
	status_in?: Array<ModelTypes["ScheduledReleaseStatus"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ModelTypes["ScheduledReleaseStatus"] | undefined> | undefined
};
	["ScheduledReleaseOrderByInput"]:ScheduledReleaseOrderByInput;
	["ScheduledReleaseStatus"]:ScheduledReleaseStatus;
	["ScheduledReleaseUpdateInput"]: {
	releaseAt?: ModelTypes["DateTime"] | undefined,
	isActive?: boolean | undefined,
	errorMessage?: string | undefined,
	description?: string | undefined,
	title?: string | undefined
};
	["ScheduledReleaseUpdateManyInlineInput"]: {
	/** Create and connect multiple ScheduledRelease documents */
	create?: Array<ModelTypes["ScheduledReleaseCreateInput"]> | undefined,
	/** Connect multiple existing ScheduledRelease documents */
	connect?: Array<ModelTypes["ScheduledReleaseConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing ScheduledRelease documents */
	set?: Array<ModelTypes["ScheduledReleaseWhereUniqueInput"]> | undefined,
	/** Update multiple ScheduledRelease documents */
	update?: Array<ModelTypes["ScheduledReleaseUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple ScheduledRelease documents */
	upsert?: Array<ModelTypes["ScheduledReleaseUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple ScheduledRelease documents */
	disconnect?: Array<ModelTypes["ScheduledReleaseWhereUniqueInput"]> | undefined,
	/** Delete multiple ScheduledRelease documents */
	delete?: Array<ModelTypes["ScheduledReleaseWhereUniqueInput"]> | undefined
};
	["ScheduledReleaseUpdateManyInput"]: {
	releaseAt?: ModelTypes["DateTime"] | undefined,
	isActive?: boolean | undefined,
	errorMessage?: string | undefined,
	description?: string | undefined,
	title?: string | undefined
};
	["ScheduledReleaseUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ModelTypes["ScheduledReleaseWhereInput"],
	/** Update many input */
	data: ModelTypes["ScheduledReleaseUpdateManyInput"]
};
	["ScheduledReleaseUpdateOneInlineInput"]: {
	/** Create and connect one ScheduledRelease document */
	create?: ModelTypes["ScheduledReleaseCreateInput"] | undefined,
	/** Update single ScheduledRelease document */
	update?: ModelTypes["ScheduledReleaseUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single ScheduledRelease document */
	upsert?: ModelTypes["ScheduledReleaseUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing ScheduledRelease document */
	connect?: ModelTypes["ScheduledReleaseWhereUniqueInput"] | undefined,
	/** Disconnect currently connected ScheduledRelease document */
	disconnect?: boolean | undefined,
	/** Delete currently connected ScheduledRelease document */
	delete?: boolean | undefined
};
	["ScheduledReleaseUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["ScheduledReleaseWhereUniqueInput"],
	/** Document to update */
	data: ModelTypes["ScheduledReleaseUpdateInput"]
};
	["ScheduledReleaseUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ModelTypes["ScheduledReleaseCreateInput"],
	/** Update document if it exists */
	update: ModelTypes["ScheduledReleaseUpdateInput"]
};
	["ScheduledReleaseUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["ScheduledReleaseWhereUniqueInput"],
	/** Upsert data */
	data: ModelTypes["ScheduledReleaseUpsertInput"]
};
	/** Identifies documents */
["ScheduledReleaseWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["ScheduledReleaseWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["ScheduledReleaseWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["ScheduledReleaseWhereInput"]> | undefined,
	releaseAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	releaseAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	releaseAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	releaseAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	releaseAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	releaseAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	releaseAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	releaseAt_gte?: ModelTypes["DateTime"] | undefined,
	isImplicit?: boolean | undefined,
	/** All values that are not equal to given value. */
	isImplicit_not?: boolean | undefined,
	isActive?: boolean | undefined,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined,
	errorMessage?: string | undefined,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	title?: string | undefined,
	/** All values that are not equal to given value. */
	title_not?: string | undefined,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	title_contains?: string | undefined,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	operations_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	operations_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	operations_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	status?: ModelTypes["ScheduledReleaseStatus"] | undefined,
	/** All values that are not equal to given value. */
	status_not?: ModelTypes["ScheduledReleaseStatus"] | undefined,
	/** All values that are contained in given list. */
	status_in?: Array<ModelTypes["ScheduledReleaseStatus"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	status_not_in?: Array<ModelTypes["ScheduledReleaseStatus"] | undefined> | undefined
};
	/** References ScheduledRelease record uniquely */
["ScheduledReleaseWhereUniqueInput"]: {
	id?: string | undefined
};
	["Skill"]: {
		/** System stage field */
	stage: ModelTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<ModelTypes["Skill"]>,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: ModelTypes["DateTime"],
	/** The time the document was created */
	createdAt: ModelTypes["DateTime"],
	/** The unique identifier */
	id: string,
	name: string,
	/** User that last published this document */
	publishedBy?: ModelTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: ModelTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: ModelTypes["User"] | undefined,
	icon?: ModelTypes["Asset"] | undefined,
	scheduledIn: Array<ModelTypes["ScheduledOperation"]>,
	/** List of Skill versions */
	history: Array<ModelTypes["Version"]>
};
	["SkillConnectInput"]: {
	/** Document to connect */
	where: ModelTypes["SkillWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ModelTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["SkillConnection"]: {
		/** Information to aid in pagination. */
	pageInfo: ModelTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<ModelTypes["SkillEdge"]>,
	aggregate: ModelTypes["Aggregate"]
};
	["SkillCreateInput"]: {
	updatedAt?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	name: string,
	icon?: ModelTypes["AssetCreateOneInlineInput"] | undefined
};
	["SkillCreateManyInlineInput"]: {
	/** Create and connect multiple existing Skill documents */
	create?: Array<ModelTypes["SkillCreateInput"]> | undefined,
	/** Connect multiple existing Skill documents */
	connect?: Array<ModelTypes["SkillWhereUniqueInput"]> | undefined
};
	["SkillCreateOneInlineInput"]: {
	/** Create and connect one Skill document */
	create?: ModelTypes["SkillCreateInput"] | undefined,
	/** Connect one existing Skill document */
	connect?: ModelTypes["SkillWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["SkillEdge"]: {
		/** The item at the end of the edge. */
	node: ModelTypes["Skill"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["SkillManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["SkillWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["SkillWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["SkillWhereInput"]> | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	icon?: ModelTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	["SkillOrderByInput"]:SkillOrderByInput;
	["SkillUpdateInput"]: {
	name?: string | undefined,
	icon?: ModelTypes["AssetUpdateOneInlineInput"] | undefined
};
	["SkillUpdateManyInlineInput"]: {
	/** Create and connect multiple Skill documents */
	create?: Array<ModelTypes["SkillCreateInput"]> | undefined,
	/** Connect multiple existing Skill documents */
	connect?: Array<ModelTypes["SkillConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing Skill documents */
	set?: Array<ModelTypes["SkillWhereUniqueInput"]> | undefined,
	/** Update multiple Skill documents */
	update?: Array<ModelTypes["SkillUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple Skill documents */
	upsert?: Array<ModelTypes["SkillUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple Skill documents */
	disconnect?: Array<ModelTypes["SkillWhereUniqueInput"]> | undefined,
	/** Delete multiple Skill documents */
	delete?: Array<ModelTypes["SkillWhereUniqueInput"]> | undefined
};
	["SkillUpdateManyInput"]: {
	/** No fields in updateMany data input */
	_?: string | undefined
};
	["SkillUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ModelTypes["SkillWhereInput"],
	/** Update many input */
	data: ModelTypes["SkillUpdateManyInput"]
};
	["SkillUpdateOneInlineInput"]: {
	/** Create and connect one Skill document */
	create?: ModelTypes["SkillCreateInput"] | undefined,
	/** Update single Skill document */
	update?: ModelTypes["SkillUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single Skill document */
	upsert?: ModelTypes["SkillUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing Skill document */
	connect?: ModelTypes["SkillWhereUniqueInput"] | undefined,
	/** Disconnect currently connected Skill document */
	disconnect?: boolean | undefined,
	/** Delete currently connected Skill document */
	delete?: boolean | undefined
};
	["SkillUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["SkillWhereUniqueInput"],
	/** Document to update */
	data: ModelTypes["SkillUpdateInput"]
};
	["SkillUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ModelTypes["SkillCreateInput"],
	/** Update document if it exists */
	update: ModelTypes["SkillUpdateInput"]
};
	["SkillUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["SkillWhereUniqueInput"],
	/** Upsert data */
	data: ModelTypes["SkillUpsertInput"]
};
	/** Identifies documents */
["SkillWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["SkillWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["SkillWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["SkillWhereInput"]> | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	icon?: ModelTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References Skill record uniquely */
["SkillWhereUniqueInput"]: {
	id?: string | undefined,
	name?: string | undefined
};
	["Social"]: {
		/** System stage field */
	stage: ModelTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<ModelTypes["Social"]>,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: ModelTypes["DateTime"],
	/** The time the document was created */
	createdAt: ModelTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** Social media name */
	name: string,
	/** Social media link */
	url: string,
	/** Social media color */
	color?: ModelTypes["Color"] | undefined,
	/** User that last published this document */
	publishedBy?: ModelTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: ModelTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: ModelTypes["User"] | undefined,
	/** Social media logo */
	image: ModelTypes["Asset"],
	scheduledIn: Array<ModelTypes["ScheduledOperation"]>,
	/** List of Social versions */
	history: Array<ModelTypes["Version"]>
};
	["SocialConnectInput"]: {
	/** Document to connect */
	where: ModelTypes["SocialWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ModelTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["SocialConnection"]: {
		/** Information to aid in pagination. */
	pageInfo: ModelTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<ModelTypes["SocialEdge"]>,
	aggregate: ModelTypes["Aggregate"]
};
	["SocialCreateInput"]: {
	updatedAt?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	name: string,
	url: string,
	color?: ModelTypes["ColorInput"] | undefined,
	image: ModelTypes["AssetCreateOneInlineInput"]
};
	["SocialCreateManyInlineInput"]: {
	/** Create and connect multiple existing Social documents */
	create?: Array<ModelTypes["SocialCreateInput"]> | undefined,
	/** Connect multiple existing Social documents */
	connect?: Array<ModelTypes["SocialWhereUniqueInput"]> | undefined
};
	["SocialCreateOneInlineInput"]: {
	/** Create and connect one Social document */
	create?: ModelTypes["SocialCreateInput"] | undefined,
	/** Connect one existing Social document */
	connect?: ModelTypes["SocialWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["SocialEdge"]: {
		/** The item at the end of the edge. */
	node: ModelTypes["Social"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["SocialManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["SocialWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["SocialWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["SocialWhereInput"]> | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	url?: string | undefined,
	/** All values that are not equal to given value. */
	url_not?: string | undefined,
	/** All values that are contained in given list. */
	url_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	url_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	url_contains?: string | undefined,
	/** All values not containing the given string. */
	url_not_contains?: string | undefined,
	/** All values starting with the given string. */
	url_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	url_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	url_ends_with?: string | undefined,
	/** All values not ending with the given string */
	url_not_ends_with?: string | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	image?: ModelTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	["SocialOrderByInput"]:SocialOrderByInput;
	["SocialUpdateInput"]: {
	name?: string | undefined,
	url?: string | undefined,
	color?: ModelTypes["ColorInput"] | undefined,
	image?: ModelTypes["AssetUpdateOneInlineInput"] | undefined
};
	["SocialUpdateManyInlineInput"]: {
	/** Create and connect multiple Social documents */
	create?: Array<ModelTypes["SocialCreateInput"]> | undefined,
	/** Connect multiple existing Social documents */
	connect?: Array<ModelTypes["SocialConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing Social documents */
	set?: Array<ModelTypes["SocialWhereUniqueInput"]> | undefined,
	/** Update multiple Social documents */
	update?: Array<ModelTypes["SocialUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple Social documents */
	upsert?: Array<ModelTypes["SocialUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple Social documents */
	disconnect?: Array<ModelTypes["SocialWhereUniqueInput"]> | undefined,
	/** Delete multiple Social documents */
	delete?: Array<ModelTypes["SocialWhereUniqueInput"]> | undefined
};
	["SocialUpdateManyInput"]: {
	name?: string | undefined,
	color?: ModelTypes["ColorInput"] | undefined
};
	["SocialUpdateManyWithNestedWhereInput"]: {
	/** Document search */
	where: ModelTypes["SocialWhereInput"],
	/** Update many input */
	data: ModelTypes["SocialUpdateManyInput"]
};
	["SocialUpdateOneInlineInput"]: {
	/** Create and connect one Social document */
	create?: ModelTypes["SocialCreateInput"] | undefined,
	/** Update single Social document */
	update?: ModelTypes["SocialUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single Social document */
	upsert?: ModelTypes["SocialUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing Social document */
	connect?: ModelTypes["SocialWhereUniqueInput"] | undefined,
	/** Disconnect currently connected Social document */
	disconnect?: boolean | undefined,
	/** Delete currently connected Social document */
	delete?: boolean | undefined
};
	["SocialUpdateWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["SocialWhereUniqueInput"],
	/** Document to update */
	data: ModelTypes["SocialUpdateInput"]
};
	["SocialUpsertInput"]: {
	/** Create document if it didn't exist */
	create: ModelTypes["SocialCreateInput"],
	/** Update document if it exists */
	update: ModelTypes["SocialUpdateInput"]
};
	["SocialUpsertWithNestedWhereUniqueInput"]: {
	/** Unique document search */
	where: ModelTypes["SocialWhereUniqueInput"],
	/** Upsert data */
	data: ModelTypes["SocialUpsertInput"]
};
	/** Identifies documents */
["SocialWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["SocialWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["SocialWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["SocialWhereInput"]> | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	url?: string | undefined,
	/** All values that are not equal to given value. */
	url_not?: string | undefined,
	/** All values that are contained in given list. */
	url_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	url_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	url_contains?: string | undefined,
	/** All values not containing the given string. */
	url_not_contains?: string | undefined,
	/** All values starting with the given string. */
	url_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	url_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	url_ends_with?: string | undefined,
	/** All values not ending with the given string */
	url_not_ends_with?: string | undefined,
	publishedBy?: ModelTypes["UserWhereInput"] | undefined,
	updatedBy?: ModelTypes["UserWhereInput"] | undefined,
	createdBy?: ModelTypes["UserWhereInput"] | undefined,
	image?: ModelTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: ModelTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: ModelTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References Social record uniquely */
["SocialWhereUniqueInput"]: {
	id?: string | undefined,
	url?: string | undefined
};
	["Stage"]:Stage;
	["SystemDateTimeFieldVariation"]:SystemDateTimeFieldVariation;
	["UnpublishLocaleInput"]: {
	/** Locales to unpublish */
	locale: ModelTypes["Locale"],
	/** Stages to unpublish selected locales from */
	stages: Array<ModelTypes["Stage"]>
};
	/** User system model */
["User"]: {
		/** System stage field */
	stage: ModelTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<ModelTypes["User"]>,
	/** Flag to determine if user is active or not */
	isActive: boolean,
	/** Profile Picture url */
	picture?: string | undefined,
	/** The username */
	name: string,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: ModelTypes["DateTime"],
	/** The time the document was created */
	createdAt: ModelTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** User Kind. Can be either MEMBER, PAT or PUBLIC */
	kind: ModelTypes["UserKind"]
};
	["UserConnectInput"]: {
	/** Document to connect */
	where: ModelTypes["UserWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: ModelTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["UserConnection"]: {
		/** Information to aid in pagination. */
	pageInfo: ModelTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<ModelTypes["UserEdge"]>,
	aggregate: ModelTypes["Aggregate"]
};
	["UserCreateManyInlineInput"]: {
	/** Connect multiple existing User documents */
	connect?: Array<ModelTypes["UserWhereUniqueInput"]> | undefined
};
	["UserCreateOneInlineInput"]: {
	/** Connect one existing User document */
	connect?: ModelTypes["UserWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["UserEdge"]: {
		/** The item at the end of the edge. */
	node: ModelTypes["User"],
	/** A cursor for use in pagination. */
	cursor: string
};
	["UserKind"]:UserKind;
	/** Identifies documents */
["UserManyWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["UserWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["UserWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["UserWhereInput"]> | undefined,
	isActive?: boolean | undefined,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined,
	picture?: string | undefined,
	/** All values that are not equal to given value. */
	picture_not?: string | undefined,
	/** All values that are contained in given list. */
	picture_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	picture_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	picture_contains?: string | undefined,
	/** All values not containing the given string. */
	picture_not_contains?: string | undefined,
	/** All values starting with the given string. */
	picture_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	picture_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	picture_ends_with?: string | undefined,
	/** All values not ending with the given string */
	picture_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	kind?: ModelTypes["UserKind"] | undefined,
	/** All values that are not equal to given value. */
	kind_not?: ModelTypes["UserKind"] | undefined,
	/** All values that are contained in given list. */
	kind_in?: Array<ModelTypes["UserKind"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	kind_not_in?: Array<ModelTypes["UserKind"] | undefined> | undefined
};
	["UserOrderByInput"]:UserOrderByInput;
	["UserUpdateManyInlineInput"]: {
	/** Connect multiple existing User documents */
	connect?: Array<ModelTypes["UserConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing User documents */
	set?: Array<ModelTypes["UserWhereUniqueInput"]> | undefined,
	/** Disconnect multiple User documents */
	disconnect?: Array<ModelTypes["UserWhereUniqueInput"]> | undefined
};
	["UserUpdateOneInlineInput"]: {
	/** Connect existing User document */
	connect?: ModelTypes["UserWhereUniqueInput"] | undefined,
	/** Disconnect currently connected User document */
	disconnect?: boolean | undefined
};
	/** Identifies documents */
["UserWhereInput"]: {
	/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<ModelTypes["UserWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<ModelTypes["UserWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<ModelTypes["UserWhereInput"]> | undefined,
	isActive?: boolean | undefined,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined,
	picture?: string | undefined,
	/** All values that are not equal to given value. */
	picture_not?: string | undefined,
	/** All values that are contained in given list. */
	picture_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	picture_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	picture_contains?: string | undefined,
	/** All values not containing the given string. */
	picture_not_contains?: string | undefined,
	/** All values starting with the given string. */
	picture_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	picture_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	picture_ends_with?: string | undefined,
	/** All values not ending with the given string */
	picture_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	publishedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: ModelTypes["DateTime"] | undefined,
	updatedAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: ModelTypes["DateTime"] | undefined,
	createdAt?: ModelTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: ModelTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<ModelTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: ModelTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: ModelTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: ModelTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: ModelTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	kind?: ModelTypes["UserKind"] | undefined,
	/** All values that are not equal to given value. */
	kind_not?: ModelTypes["UserKind"] | undefined,
	/** All values that are contained in given list. */
	kind_in?: Array<ModelTypes["UserKind"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	kind_not_in?: Array<ModelTypes["UserKind"] | undefined> | undefined
};
	/** References User record uniquely */
["UserWhereUniqueInput"]: {
	id?: string | undefined
};
	["Version"]: {
		id: string,
	stage: ModelTypes["Stage"],
	revision: number,
	createdAt: ModelTypes["DateTime"]
};
	["VersionWhereInput"]: {
	id: string,
	stage: ModelTypes["Stage"],
	revision: number
};
	["_FilterKind"]:_FilterKind;
	["_MutationInputFieldKind"]:_MutationInputFieldKind;
	["_MutationKind"]:_MutationKind;
	["_OrderDirection"]:_OrderDirection;
	["_RelationInputCardinality"]:_RelationInputCardinality;
	["_RelationInputKind"]:_RelationInputKind;
	["_RelationKind"]:_RelationKind;
	["_SystemDateTimeFieldVariation"]:_SystemDateTimeFieldVariation
    }

export type GraphQLTypes = {
    ["Aggregate"]: {
	__typename: "Aggregate",
	count: number
};
	/** Asset system model */
["Asset"]: {
	__typename: "Asset",
	/** System stage field */
	stage: GraphQLTypes["Stage"],
	/** System Locale field */
	locale: GraphQLTypes["Locale"],
	/** Get the other localizations for this document */
	localizations: Array<GraphQLTypes["Asset"]>,
	/** Get the document in other stages */
	documentInStages: Array<GraphQLTypes["Asset"]>,
	/** The mime type of the file */
	mimeType?: string | undefined,
	/** The file size */
	size?: number | undefined,
	/** The file width */
	width?: number | undefined,
	/** The height of the file */
	height?: number | undefined,
	/** The file name */
	fileName: string,
	/** The file handle */
	handle: string,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: GraphQLTypes["DateTime"],
	/** The time the document was created */
	createdAt: GraphQLTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** User that last published this document */
	publishedBy?: GraphQLTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: GraphQLTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: GraphQLTypes["User"] | undefined,
	imageProject: Array<GraphQLTypes["Project"]>,
	imageSocial: Array<GraphQLTypes["Social"]>,
	imagePageMetadata: Array<GraphQLTypes["PageMetadata"]>,
	iconSkill: Array<GraphQLTypes["Skill"]>,
	scheduledIn: Array<GraphQLTypes["ScheduledOperation"]>,
	/** List of Asset versions */
	history: Array<GraphQLTypes["Version"]>,
	/** Get the url for the asset with provided transformations applied. */
	url: string
};
	["AssetConnectInput"]: {
		/** Document to connect */
	where: GraphQLTypes["AssetWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: GraphQLTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["AssetConnection"]: {
	__typename: "AssetConnection",
	/** Information to aid in pagination. */
	pageInfo: GraphQLTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<GraphQLTypes["AssetEdge"]>,
	aggregate: GraphQLTypes["Aggregate"]
};
	["AssetCreateInput"]: {
		mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName: string,
	handle: string,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	imageProject?: GraphQLTypes["ProjectCreateManyInlineInput"] | undefined,
	imageSocial?: GraphQLTypes["SocialCreateManyInlineInput"] | undefined,
	imagePageMetadata?: GraphQLTypes["PageMetadataCreateManyInlineInput"] | undefined,
	iconSkill?: GraphQLTypes["SkillCreateManyInlineInput"] | undefined,
	/** Inline mutations for managing document localizations excluding the default locale */
	localizations?: GraphQLTypes["AssetCreateLocalizationsInput"] | undefined
};
	["AssetCreateLocalizationDataInput"]: {
		mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName: string,
	handle: string,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined
};
	["AssetCreateLocalizationInput"]: {
		/** Localization input */
	data: GraphQLTypes["AssetCreateLocalizationDataInput"],
	locale: GraphQLTypes["Locale"]
};
	["AssetCreateLocalizationsInput"]: {
		/** Create localizations for the newly-created document */
	create?: Array<GraphQLTypes["AssetCreateLocalizationInput"]> | undefined
};
	["AssetCreateManyInlineInput"]: {
		/** Create and connect multiple existing Asset documents */
	create?: Array<GraphQLTypes["AssetCreateInput"]> | undefined,
	/** Connect multiple existing Asset documents */
	connect?: Array<GraphQLTypes["AssetWhereUniqueInput"]> | undefined
};
	["AssetCreateOneInlineInput"]: {
		/** Create and connect one Asset document */
	create?: GraphQLTypes["AssetCreateInput"] | undefined,
	/** Connect one existing Asset document */
	connect?: GraphQLTypes["AssetWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["AssetEdge"]: {
	__typename: "AssetEdge",
	/** The item at the end of the edge. */
	node: GraphQLTypes["Asset"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["AssetManyWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["AssetWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["AssetWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["AssetWhereInput"]> | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	imageProject_every?: GraphQLTypes["ProjectWhereInput"] | undefined,
	imageProject_some?: GraphQLTypes["ProjectWhereInput"] | undefined,
	imageProject_none?: GraphQLTypes["ProjectWhereInput"] | undefined,
	imageSocial_every?: GraphQLTypes["SocialWhereInput"] | undefined,
	imageSocial_some?: GraphQLTypes["SocialWhereInput"] | undefined,
	imageSocial_none?: GraphQLTypes["SocialWhereInput"] | undefined,
	imagePageMetadata_every?: GraphQLTypes["PageMetadataWhereInput"] | undefined,
	imagePageMetadata_some?: GraphQLTypes["PageMetadataWhereInput"] | undefined,
	imagePageMetadata_none?: GraphQLTypes["PageMetadataWhereInput"] | undefined,
	iconSkill_every?: GraphQLTypes["SkillWhereInput"] | undefined,
	iconSkill_some?: GraphQLTypes["SkillWhereInput"] | undefined,
	iconSkill_none?: GraphQLTypes["SkillWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	["AssetOrderByInput"]: AssetOrderByInput;
	/** Transformations for Assets */
["AssetTransformationInput"]: {
		image?: GraphQLTypes["ImageTransformationInput"] | undefined,
	document?: GraphQLTypes["DocumentTransformationInput"] | undefined,
	/** Pass true if you want to validate the passed transformation parameters */
	validateOptions?: boolean | undefined
};
	["AssetUpdateInput"]: {
		mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName?: string | undefined,
	handle?: string | undefined,
	imageProject?: GraphQLTypes["ProjectUpdateManyInlineInput"] | undefined,
	imageSocial?: GraphQLTypes["SocialUpdateManyInlineInput"] | undefined,
	imagePageMetadata?: GraphQLTypes["PageMetadataUpdateManyInlineInput"] | undefined,
	iconSkill?: GraphQLTypes["SkillUpdateManyInlineInput"] | undefined,
	/** Manage document localizations */
	localizations?: GraphQLTypes["AssetUpdateLocalizationsInput"] | undefined
};
	["AssetUpdateLocalizationDataInput"]: {
		mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName?: string | undefined,
	handle?: string | undefined
};
	["AssetUpdateLocalizationInput"]: {
		data: GraphQLTypes["AssetUpdateLocalizationDataInput"],
	locale: GraphQLTypes["Locale"]
};
	["AssetUpdateLocalizationsInput"]: {
		/** Localizations to create */
	create?: Array<GraphQLTypes["AssetCreateLocalizationInput"]> | undefined,
	/** Localizations to update */
	update?: Array<GraphQLTypes["AssetUpdateLocalizationInput"]> | undefined,
	upsert?: Array<GraphQLTypes["AssetUpsertLocalizationInput"]> | undefined,
	/** Localizations to delete */
	delete?: Array<GraphQLTypes["Locale"]> | undefined
};
	["AssetUpdateManyInlineInput"]: {
		/** Create and connect multiple Asset documents */
	create?: Array<GraphQLTypes["AssetCreateInput"]> | undefined,
	/** Connect multiple existing Asset documents */
	connect?: Array<GraphQLTypes["AssetConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing Asset documents */
	set?: Array<GraphQLTypes["AssetWhereUniqueInput"]> | undefined,
	/** Update multiple Asset documents */
	update?: Array<GraphQLTypes["AssetUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple Asset documents */
	upsert?: Array<GraphQLTypes["AssetUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple Asset documents */
	disconnect?: Array<GraphQLTypes["AssetWhereUniqueInput"]> | undefined,
	/** Delete multiple Asset documents */
	delete?: Array<GraphQLTypes["AssetWhereUniqueInput"]> | undefined
};
	["AssetUpdateManyInput"]: {
		mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName?: string | undefined,
	/** Optional updates to localizations */
	localizations?: GraphQLTypes["AssetUpdateManyLocalizationsInput"] | undefined
};
	["AssetUpdateManyLocalizationDataInput"]: {
		mimeType?: string | undefined,
	size?: number | undefined,
	width?: number | undefined,
	height?: number | undefined,
	fileName?: string | undefined
};
	["AssetUpdateManyLocalizationInput"]: {
		data: GraphQLTypes["AssetUpdateManyLocalizationDataInput"],
	locale: GraphQLTypes["Locale"]
};
	["AssetUpdateManyLocalizationsInput"]: {
		/** Localizations to update */
	update?: Array<GraphQLTypes["AssetUpdateManyLocalizationInput"]> | undefined
};
	["AssetUpdateManyWithNestedWhereInput"]: {
		/** Document search */
	where: GraphQLTypes["AssetWhereInput"],
	/** Update many input */
	data: GraphQLTypes["AssetUpdateManyInput"]
};
	["AssetUpdateOneInlineInput"]: {
		/** Create and connect one Asset document */
	create?: GraphQLTypes["AssetCreateInput"] | undefined,
	/** Update single Asset document */
	update?: GraphQLTypes["AssetUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single Asset document */
	upsert?: GraphQLTypes["AssetUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing Asset document */
	connect?: GraphQLTypes["AssetWhereUniqueInput"] | undefined,
	/** Disconnect currently connected Asset document */
	disconnect?: boolean | undefined,
	/** Delete currently connected Asset document */
	delete?: boolean | undefined
};
	["AssetUpdateWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["AssetWhereUniqueInput"],
	/** Document to update */
	data: GraphQLTypes["AssetUpdateInput"]
};
	["AssetUpsertInput"]: {
		/** Create document if it didn't exist */
	create: GraphQLTypes["AssetCreateInput"],
	/** Update document if it exists */
	update: GraphQLTypes["AssetUpdateInput"]
};
	["AssetUpsertLocalizationInput"]: {
		update: GraphQLTypes["AssetUpdateLocalizationDataInput"],
	create: GraphQLTypes["AssetCreateLocalizationDataInput"],
	locale: GraphQLTypes["Locale"]
};
	["AssetUpsertWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["AssetWhereUniqueInput"],
	/** Upsert data */
	data: GraphQLTypes["AssetUpsertInput"]
};
	/** Identifies documents */
["AssetWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["AssetWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["AssetWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["AssetWhereInput"]> | undefined,
	mimeType?: string | undefined,
	/** All values that are not equal to given value. */
	mimeType_not?: string | undefined,
	/** All values that are contained in given list. */
	mimeType_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	mimeType_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	mimeType_contains?: string | undefined,
	/** All values not containing the given string. */
	mimeType_not_contains?: string | undefined,
	/** All values starting with the given string. */
	mimeType_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	mimeType_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	mimeType_ends_with?: string | undefined,
	/** All values not ending with the given string */
	mimeType_not_ends_with?: string | undefined,
	size?: number | undefined,
	/** All values that are not equal to given value. */
	size_not?: number | undefined,
	/** All values that are contained in given list. */
	size_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	size_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	size_lt?: number | undefined,
	/** All values less than or equal the given value. */
	size_lte?: number | undefined,
	/** All values greater than the given value. */
	size_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	size_gte?: number | undefined,
	width?: number | undefined,
	/** All values that are not equal to given value. */
	width_not?: number | undefined,
	/** All values that are contained in given list. */
	width_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	width_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	width_lt?: number | undefined,
	/** All values less than or equal the given value. */
	width_lte?: number | undefined,
	/** All values greater than the given value. */
	width_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	width_gte?: number | undefined,
	height?: number | undefined,
	/** All values that are not equal to given value. */
	height_not?: number | undefined,
	/** All values that are contained in given list. */
	height_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	height_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	height_lt?: number | undefined,
	/** All values less than or equal the given value. */
	height_lte?: number | undefined,
	/** All values greater than the given value. */
	height_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	height_gte?: number | undefined,
	fileName?: string | undefined,
	/** All values that are not equal to given value. */
	fileName_not?: string | undefined,
	/** All values that are contained in given list. */
	fileName_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	fileName_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	fileName_contains?: string | undefined,
	/** All values not containing the given string. */
	fileName_not_contains?: string | undefined,
	/** All values starting with the given string. */
	fileName_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	fileName_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	fileName_ends_with?: string | undefined,
	/** All values not ending with the given string */
	fileName_not_ends_with?: string | undefined,
	handle?: string | undefined,
	/** All values that are not equal to given value. */
	handle_not?: string | undefined,
	/** All values that are contained in given list. */
	handle_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	handle_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	handle_contains?: string | undefined,
	/** All values not containing the given string. */
	handle_not_contains?: string | undefined,
	/** All values starting with the given string. */
	handle_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	handle_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	handle_ends_with?: string | undefined,
	/** All values not ending with the given string */
	handle_not_ends_with?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	imageProject_every?: GraphQLTypes["ProjectWhereInput"] | undefined,
	imageProject_some?: GraphQLTypes["ProjectWhereInput"] | undefined,
	imageProject_none?: GraphQLTypes["ProjectWhereInput"] | undefined,
	imageSocial_every?: GraphQLTypes["SocialWhereInput"] | undefined,
	imageSocial_some?: GraphQLTypes["SocialWhereInput"] | undefined,
	imageSocial_none?: GraphQLTypes["SocialWhereInput"] | undefined,
	imagePageMetadata_every?: GraphQLTypes["PageMetadataWhereInput"] | undefined,
	imagePageMetadata_some?: GraphQLTypes["PageMetadataWhereInput"] | undefined,
	imagePageMetadata_none?: GraphQLTypes["PageMetadataWhereInput"] | undefined,
	iconSkill_every?: GraphQLTypes["SkillWhereInput"] | undefined,
	iconSkill_some?: GraphQLTypes["SkillWhereInput"] | undefined,
	iconSkill_none?: GraphQLTypes["SkillWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References Asset record uniquely */
["AssetWhereUniqueInput"]: {
		id?: string | undefined
};
	["BatchPayload"]: {
	__typename: "BatchPayload",
	/** The number of nodes that have been affected by the Batch operation. */
	count: GraphQLTypes["Long"]
};
	/** Representing a color value comprising of HEX, RGBA and css color values */
["Color"]: {
	__typename: "Color",
	hex: GraphQLTypes["Hex"],
	rgba: GraphQLTypes["RGBA"],
	css: string
};
	/** Accepts either HEX or RGBA color value. At least one of hex or rgba value should be passed. If both are passed RGBA is used. */
["ColorInput"]: {
		hex?: GraphQLTypes["Hex"] | undefined,
	rgba?: GraphQLTypes["RGBAInput"] | undefined
};
	["ConnectPositionInput"]: {
		/** Connect document after specified document */
	after?: string | undefined,
	/** Connect document before specified document */
	before?: string | undefined,
	/** Connect document at first position */
	start?: boolean | undefined,
	/** Connect document at last position */
	end?: boolean | undefined
};
	/** A date string, such as 2007-12-03 (YYYY-MM-DD), compliant with ISO 8601 standard for representation of dates using the Gregorian calendar. */
["Date"]: "scalar" & { name: "Date" };
	/** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the date-timeformat outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representationof dates and times using the Gregorian calendar. */
["DateTime"]: "scalar" & { name: "DateTime" };
	["DocumentFileTypes"]: DocumentFileTypes;
	["DocumentOutputInput"]: {
		/** Transforms a document into a desired file type.
See this matrix for format support:

PDF:	jpg, odp, ods, odt, png, svg, txt, and webp
DOC:	docx, html, jpg, odt, pdf, png, svg, txt, and webp
DOCX:	doc, html, jpg, odt, pdf, png, svg, txt, and webp
ODT:	doc, docx, html, jpg, pdf, png, svg, txt, and webp
XLS:	jpg, pdf, ods, png, svg, xlsx, and webp
XLSX:	jpg, pdf, ods, png, svg, xls, and webp
ODS:	jpg, pdf, png, xls, svg, xlsx, and webp
PPT:	jpg, odp, pdf, png, svg, pptx, and webp
PPTX:	jpg, odp, pdf, png, svg, ppt, and webp
ODP:	jpg, pdf, png, ppt, svg, pptx, and webp
BMP:	jpg, odp, ods, odt, pdf, png, svg, and webp
GIF:	jpg, odp, ods, odt, pdf, png, svg, and webp
JPG:	jpg, odp, ods, odt, pdf, png, svg, and webp
PNG:	jpg, odp, ods, odt, pdf, png, svg, and webp
WEBP:	jpg, odp, ods, odt, pdf, png, svg, and webp
TIFF:	jpg, odp, ods, odt, pdf, png, svg, and webp
AI:	    jpg, odp, ods, odt, pdf, png, svg, and webp
PSD:	jpg, odp, ods, odt, pdf, png, svg, and webp
SVG:	jpg, odp, ods, odt, pdf, png, and webp
HTML:	jpg, odt, pdf, svg, txt, and webp
TXT:	jpg, html, odt, pdf, svg, and webp */
	format?: GraphQLTypes["DocumentFileTypes"] | undefined
};
	/** Transformations for Documents */
["DocumentTransformationInput"]: {
		/** Changes the output for the file. */
	output?: GraphQLTypes["DocumentOutputInput"] | undefined
};
	["DocumentVersion"]: {
	__typename: "DocumentVersion",
	id: string,
	stage: GraphQLTypes["Stage"],
	revision: number,
	createdAt: GraphQLTypes["DateTime"],
	data?: GraphQLTypes["Json"] | undefined
};
	["Hex"]: "scalar" & { name: "Hex" };
	["ImageFit"]: ImageFit;
	["ImageResizeInput"]: {
		/** The width in pixels to resize the image to. The value must be an integer from 1 to 10000. */
	width?: number | undefined,
	/** The height in pixels to resize the image to. The value must be an integer from 1 to 10000. */
	height?: number | undefined,
	/** The default value for the fit parameter is fit:clip. */
	fit?: GraphQLTypes["ImageFit"] | undefined
};
	/** Transformations for Images */
["ImageTransformationInput"]: {
		/** Resizes the image */
	resize?: GraphQLTypes["ImageResizeInput"] | undefined
};
	/** Raw JSON value */
["Json"]: "scalar" & { name: "Json" };
	/** Locale system enumeration */
["Locale"]: Locale;
	/** Representing a geolocation point with latitude and longitude */
["Location"]: {
	__typename: "Location",
	latitude: number,
	longitude: number,
	distance: number
};
	/** Input for a geolocation point with latitude and longitude */
["LocationInput"]: {
		latitude: number,
	longitude: number
};
	/** The Long scalar type represents non-fractional signed whole numeric values. Long can represent values between -(2^63) and 2^63 - 1. */
["Long"]: "scalar" & { name: "Long" };
	["Mutation"]: {
	__typename: "Mutation",
	/** Create one asset */
	createAsset?: GraphQLTypes["Asset"] | undefined,
	/** Update one asset */
	updateAsset?: GraphQLTypes["Asset"] | undefined,
	/** Delete one asset from _all_ existing stages. Returns deleted document. */
	deleteAsset?: GraphQLTypes["Asset"] | undefined,
	/** Upsert one asset */
	upsertAsset?: GraphQLTypes["Asset"] | undefined,
	/** Publish one asset */
	publishAsset?: GraphQLTypes["Asset"] | undefined,
	/** Unpublish one asset from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishAsset?: GraphQLTypes["Asset"] | undefined,
	/** Update many Asset documents */
	updateManyAssetsConnection: GraphQLTypes["AssetConnection"],
	/** Delete many Asset documents, return deleted documents */
	deleteManyAssetsConnection: GraphQLTypes["AssetConnection"],
	/** Publish many Asset documents */
	publishManyAssetsConnection: GraphQLTypes["AssetConnection"],
	/** Find many Asset documents that match criteria in specified stage and unpublish from target stages */
	unpublishManyAssetsConnection: GraphQLTypes["AssetConnection"],
	/** Update many assets */
	updateManyAssets: GraphQLTypes["BatchPayload"],
	/** Delete many Asset documents */
	deleteManyAssets: GraphQLTypes["BatchPayload"],
	/** Publish many Asset documents */
	publishManyAssets: GraphQLTypes["BatchPayload"],
	/** Unpublish many Asset documents */
	unpublishManyAssets: GraphQLTypes["BatchPayload"],
	/** Schedule to publish one asset */
	schedulePublishAsset?: GraphQLTypes["Asset"] | undefined,
	/** Unpublish one asset from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishAsset?: GraphQLTypes["Asset"] | undefined,
	/** Delete and return scheduled operation */
	deleteScheduledOperation?: GraphQLTypes["ScheduledOperation"] | undefined,
	/** Create one scheduledRelease */
	createScheduledRelease?: GraphQLTypes["ScheduledRelease"] | undefined,
	/** Update one scheduledRelease */
	updateScheduledRelease?: GraphQLTypes["ScheduledRelease"] | undefined,
	/** Delete one scheduledRelease from _all_ existing stages. Returns deleted document. */
	deleteScheduledRelease?: GraphQLTypes["ScheduledRelease"] | undefined,
	/** Create one project */
	createProject?: GraphQLTypes["Project"] | undefined,
	/** Update one project */
	updateProject?: GraphQLTypes["Project"] | undefined,
	/** Delete one project from _all_ existing stages. Returns deleted document. */
	deleteProject?: GraphQLTypes["Project"] | undefined,
	/** Upsert one project */
	upsertProject?: GraphQLTypes["Project"] | undefined,
	/** Publish one project */
	publishProject?: GraphQLTypes["Project"] | undefined,
	/** Unpublish one project from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishProject?: GraphQLTypes["Project"] | undefined,
	/** Update many Project documents */
	updateManyProjectsConnection: GraphQLTypes["ProjectConnection"],
	/** Delete many Project documents, return deleted documents */
	deleteManyProjectsConnection: GraphQLTypes["ProjectConnection"],
	/** Publish many Project documents */
	publishManyProjectsConnection: GraphQLTypes["ProjectConnection"],
	/** Find many Project documents that match criteria in specified stage and unpublish from target stages */
	unpublishManyProjectsConnection: GraphQLTypes["ProjectConnection"],
	/** Update many projects */
	updateManyProjects: GraphQLTypes["BatchPayload"],
	/** Delete many Project documents */
	deleteManyProjects: GraphQLTypes["BatchPayload"],
	/** Publish many Project documents */
	publishManyProjects: GraphQLTypes["BatchPayload"],
	/** Unpublish many Project documents */
	unpublishManyProjects: GraphQLTypes["BatchPayload"],
	/** Schedule to publish one project */
	schedulePublishProject?: GraphQLTypes["Project"] | undefined,
	/** Unpublish one project from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishProject?: GraphQLTypes["Project"] | undefined,
	/** Create one social */
	createSocial?: GraphQLTypes["Social"] | undefined,
	/** Update one social */
	updateSocial?: GraphQLTypes["Social"] | undefined,
	/** Delete one social from _all_ existing stages. Returns deleted document. */
	deleteSocial?: GraphQLTypes["Social"] | undefined,
	/** Upsert one social */
	upsertSocial?: GraphQLTypes["Social"] | undefined,
	/** Publish one social */
	publishSocial?: GraphQLTypes["Social"] | undefined,
	/** Unpublish one social from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishSocial?: GraphQLTypes["Social"] | undefined,
	/** Update many Social documents */
	updateManySocialsConnection: GraphQLTypes["SocialConnection"],
	/** Delete many Social documents, return deleted documents */
	deleteManySocialsConnection: GraphQLTypes["SocialConnection"],
	/** Publish many Social documents */
	publishManySocialsConnection: GraphQLTypes["SocialConnection"],
	/** Find many Social documents that match criteria in specified stage and unpublish from target stages */
	unpublishManySocialsConnection: GraphQLTypes["SocialConnection"],
	/** Update many socials */
	updateManySocials: GraphQLTypes["BatchPayload"],
	/** Delete many Social documents */
	deleteManySocials: GraphQLTypes["BatchPayload"],
	/** Publish many Social documents */
	publishManySocials: GraphQLTypes["BatchPayload"],
	/** Unpublish many Social documents */
	unpublishManySocials: GraphQLTypes["BatchPayload"],
	/** Schedule to publish one social */
	schedulePublishSocial?: GraphQLTypes["Social"] | undefined,
	/** Unpublish one social from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishSocial?: GraphQLTypes["Social"] | undefined,
	/** Create one pageMetadata */
	createPageMetadata?: GraphQLTypes["PageMetadata"] | undefined,
	/** Update one pageMetadata */
	updatePageMetadata?: GraphQLTypes["PageMetadata"] | undefined,
	/** Delete one pageMetadata from _all_ existing stages. Returns deleted document. */
	deletePageMetadata?: GraphQLTypes["PageMetadata"] | undefined,
	/** Upsert one pageMetadata */
	upsertPageMetadata?: GraphQLTypes["PageMetadata"] | undefined,
	/** Publish one pageMetadata */
	publishPageMetadata?: GraphQLTypes["PageMetadata"] | undefined,
	/** Unpublish one pageMetadata from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishPageMetadata?: GraphQLTypes["PageMetadata"] | undefined,
	/** Update many PageMetadata documents */
	updateManyPagesMetadataConnection: GraphQLTypes["PageMetadataConnection"],
	/** Delete many PageMetadata documents, return deleted documents */
	deleteManyPagesMetadataConnection: GraphQLTypes["PageMetadataConnection"],
	/** Publish many PageMetadata documents */
	publishManyPagesMetadataConnection: GraphQLTypes["PageMetadataConnection"],
	/** Find many PageMetadata documents that match criteria in specified stage and unpublish from target stages */
	unpublishManyPagesMetadataConnection: GraphQLTypes["PageMetadataConnection"],
	/** Update many pagesMetadata */
	updateManyPagesMetadata: GraphQLTypes["BatchPayload"],
	/** Delete many PageMetadata documents */
	deleteManyPagesMetadata: GraphQLTypes["BatchPayload"],
	/** Publish many PageMetadata documents */
	publishManyPagesMetadata: GraphQLTypes["BatchPayload"],
	/** Unpublish many PageMetadata documents */
	unpublishManyPagesMetadata: GraphQLTypes["BatchPayload"],
	/** Schedule to publish one pageMetadata */
	schedulePublishPageMetadata?: GraphQLTypes["PageMetadata"] | undefined,
	/** Unpublish one pageMetadata from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishPageMetadata?: GraphQLTypes["PageMetadata"] | undefined,
	/** Create one skill */
	createSkill?: GraphQLTypes["Skill"] | undefined,
	/** Update one skill */
	updateSkill?: GraphQLTypes["Skill"] | undefined,
	/** Delete one skill from _all_ existing stages. Returns deleted document. */
	deleteSkill?: GraphQLTypes["Skill"] | undefined,
	/** Upsert one skill */
	upsertSkill?: GraphQLTypes["Skill"] | undefined,
	/** Publish one skill */
	publishSkill?: GraphQLTypes["Skill"] | undefined,
	/** Unpublish one skill from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	unpublishSkill?: GraphQLTypes["Skill"] | undefined,
	/** Update many Skill documents */
	updateManySkillsConnection: GraphQLTypes["SkillConnection"],
	/** Delete many Skill documents, return deleted documents */
	deleteManySkillsConnection: GraphQLTypes["SkillConnection"],
	/** Publish many Skill documents */
	publishManySkillsConnection: GraphQLTypes["SkillConnection"],
	/** Find many Skill documents that match criteria in specified stage and unpublish from target stages */
	unpublishManySkillsConnection: GraphQLTypes["SkillConnection"],
	/** Update many skills */
	updateManySkills: GraphQLTypes["BatchPayload"],
	/** Delete many Skill documents */
	deleteManySkills: GraphQLTypes["BatchPayload"],
	/** Publish many Skill documents */
	publishManySkills: GraphQLTypes["BatchPayload"],
	/** Unpublish many Skill documents */
	unpublishManySkills: GraphQLTypes["BatchPayload"],
	/** Schedule to publish one skill */
	schedulePublishSkill?: GraphQLTypes["Skill"] | undefined,
	/** Unpublish one skill from selected stages. Unpublish either the complete document with its relations, localizations and base data or specific localizations only. */
	scheduleUnpublishSkill?: GraphQLTypes["Skill"] | undefined
};
	/** An object with an ID */
["Node"]: {
	__typename:"Asset" | "PageMetadata" | "Project" | "ScheduledOperation" | "ScheduledRelease" | "Skill" | "Social" | "User",
	/** The id of the object. */
	id: string,
	/** The Stage of an object */
	stage: GraphQLTypes["Stage"]
	['...on Asset']: '__union' & GraphQLTypes["Asset"];
	['...on PageMetadata']: '__union' & GraphQLTypes["PageMetadata"];
	['...on Project']: '__union' & GraphQLTypes["Project"];
	['...on ScheduledOperation']: '__union' & GraphQLTypes["ScheduledOperation"];
	['...on ScheduledRelease']: '__union' & GraphQLTypes["ScheduledRelease"];
	['...on Skill']: '__union' & GraphQLTypes["Skill"];
	['...on Social']: '__union' & GraphQLTypes["Social"];
	['...on User']: '__union' & GraphQLTypes["User"];
};
	/** Information about pagination in a connection. */
["PageInfo"]: {
	__typename: "PageInfo",
	/** When paginating forwards, are there more items? */
	hasNextPage: boolean,
	/** When paginating backwards, are there more items? */
	hasPreviousPage: boolean,
	/** When paginating backwards, the cursor to continue. */
	startCursor?: string | undefined,
	/** When paginating forwards, the cursor to continue. */
	endCursor?: string | undefined,
	/** Number of items in the current page. */
	pageSize?: number | undefined
};
	/** Page Metadata */
["PageMetadata"]: {
	__typename: "PageMetadata",
	/** System stage field */
	stage: GraphQLTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<GraphQLTypes["PageMetadata"]>,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: GraphQLTypes["DateTime"],
	/** The time the document was created */
	createdAt: GraphQLTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** Page title */
	title: string,
	/** Page content summary */
	summary: string,
	/** Page slug */
	slug?: string | undefined,
	/** Page number */
	pageNumber: number,
	/** User that last published this document */
	publishedBy?: GraphQLTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: GraphQLTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: GraphQLTypes["User"] | undefined,
	/** Page image */
	image?: GraphQLTypes["Asset"] | undefined,
	scheduledIn: Array<GraphQLTypes["ScheduledOperation"]>,
	/** List of PageMetadata versions */
	history: Array<GraphQLTypes["Version"]>
};
	["PageMetadataConnectInput"]: {
		/** Document to connect */
	where: GraphQLTypes["PageMetadataWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: GraphQLTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["PageMetadataConnection"]: {
	__typename: "PageMetadataConnection",
	/** Information to aid in pagination. */
	pageInfo: GraphQLTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<GraphQLTypes["PageMetadataEdge"]>,
	aggregate: GraphQLTypes["Aggregate"]
};
	["PageMetadataCreateInput"]: {
		updatedAt?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	title: string,
	summary: string,
	slug?: string | undefined,
	pageNumber: number,
	image?: GraphQLTypes["AssetCreateOneInlineInput"] | undefined
};
	["PageMetadataCreateManyInlineInput"]: {
		/** Create and connect multiple existing PageMetadata documents */
	create?: Array<GraphQLTypes["PageMetadataCreateInput"]> | undefined,
	/** Connect multiple existing PageMetadata documents */
	connect?: Array<GraphQLTypes["PageMetadataWhereUniqueInput"]> | undefined
};
	["PageMetadataCreateOneInlineInput"]: {
		/** Create and connect one PageMetadata document */
	create?: GraphQLTypes["PageMetadataCreateInput"] | undefined,
	/** Connect one existing PageMetadata document */
	connect?: GraphQLTypes["PageMetadataWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["PageMetadataEdge"]: {
	__typename: "PageMetadataEdge",
	/** The item at the end of the edge. */
	node: GraphQLTypes["PageMetadata"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["PageMetadataManyWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["PageMetadataWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["PageMetadataWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["PageMetadataWhereInput"]> | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	title?: string | undefined,
	/** All values that are not equal to given value. */
	title_not?: string | undefined,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	title_contains?: string | undefined,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined,
	summary?: string | undefined,
	/** All values that are not equal to given value. */
	summary_not?: string | undefined,
	/** All values that are contained in given list. */
	summary_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	summary_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	summary_contains?: string | undefined,
	/** All values not containing the given string. */
	summary_not_contains?: string | undefined,
	/** All values starting with the given string. */
	summary_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	summary_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	summary_ends_with?: string | undefined,
	/** All values not ending with the given string */
	summary_not_ends_with?: string | undefined,
	slug?: string | undefined,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	slug_contains?: string | undefined,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined,
	pageNumber?: number | undefined,
	/** All values that are not equal to given value. */
	pageNumber_not?: number | undefined,
	/** All values that are contained in given list. */
	pageNumber_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	pageNumber_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	pageNumber_lt?: number | undefined,
	/** All values less than or equal the given value. */
	pageNumber_lte?: number | undefined,
	/** All values greater than the given value. */
	pageNumber_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	pageNumber_gte?: number | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	image?: GraphQLTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	["PageMetadataOrderByInput"]: PageMetadataOrderByInput;
	["PageMetadataUpdateInput"]: {
		title?: string | undefined,
	summary?: string | undefined,
	slug?: string | undefined,
	pageNumber?: number | undefined,
	image?: GraphQLTypes["AssetUpdateOneInlineInput"] | undefined
};
	["PageMetadataUpdateManyInlineInput"]: {
		/** Create and connect multiple PageMetadata documents */
	create?: Array<GraphQLTypes["PageMetadataCreateInput"]> | undefined,
	/** Connect multiple existing PageMetadata documents */
	connect?: Array<GraphQLTypes["PageMetadataConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing PageMetadata documents */
	set?: Array<GraphQLTypes["PageMetadataWhereUniqueInput"]> | undefined,
	/** Update multiple PageMetadata documents */
	update?: Array<GraphQLTypes["PageMetadataUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple PageMetadata documents */
	upsert?: Array<GraphQLTypes["PageMetadataUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple PageMetadata documents */
	disconnect?: Array<GraphQLTypes["PageMetadataWhereUniqueInput"]> | undefined,
	/** Delete multiple PageMetadata documents */
	delete?: Array<GraphQLTypes["PageMetadataWhereUniqueInput"]> | undefined
};
	["PageMetadataUpdateManyInput"]: {
		summary?: string | undefined,
	pageNumber?: number | undefined
};
	["PageMetadataUpdateManyWithNestedWhereInput"]: {
		/** Document search */
	where: GraphQLTypes["PageMetadataWhereInput"],
	/** Update many input */
	data: GraphQLTypes["PageMetadataUpdateManyInput"]
};
	["PageMetadataUpdateOneInlineInput"]: {
		/** Create and connect one PageMetadata document */
	create?: GraphQLTypes["PageMetadataCreateInput"] | undefined,
	/** Update single PageMetadata document */
	update?: GraphQLTypes["PageMetadataUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single PageMetadata document */
	upsert?: GraphQLTypes["PageMetadataUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing PageMetadata document */
	connect?: GraphQLTypes["PageMetadataWhereUniqueInput"] | undefined,
	/** Disconnect currently connected PageMetadata document */
	disconnect?: boolean | undefined,
	/** Delete currently connected PageMetadata document */
	delete?: boolean | undefined
};
	["PageMetadataUpdateWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["PageMetadataWhereUniqueInput"],
	/** Document to update */
	data: GraphQLTypes["PageMetadataUpdateInput"]
};
	["PageMetadataUpsertInput"]: {
		/** Create document if it didn't exist */
	create: GraphQLTypes["PageMetadataCreateInput"],
	/** Update document if it exists */
	update: GraphQLTypes["PageMetadataUpdateInput"]
};
	["PageMetadataUpsertWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["PageMetadataWhereUniqueInput"],
	/** Upsert data */
	data: GraphQLTypes["PageMetadataUpsertInput"]
};
	/** Identifies documents */
["PageMetadataWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["PageMetadataWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["PageMetadataWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["PageMetadataWhereInput"]> | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	title?: string | undefined,
	/** All values that are not equal to given value. */
	title_not?: string | undefined,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	title_contains?: string | undefined,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined,
	summary?: string | undefined,
	/** All values that are not equal to given value. */
	summary_not?: string | undefined,
	/** All values that are contained in given list. */
	summary_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	summary_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	summary_contains?: string | undefined,
	/** All values not containing the given string. */
	summary_not_contains?: string | undefined,
	/** All values starting with the given string. */
	summary_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	summary_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	summary_ends_with?: string | undefined,
	/** All values not ending with the given string */
	summary_not_ends_with?: string | undefined,
	slug?: string | undefined,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	slug_contains?: string | undefined,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined,
	pageNumber?: number | undefined,
	/** All values that are not equal to given value. */
	pageNumber_not?: number | undefined,
	/** All values that are contained in given list. */
	pageNumber_in?: Array<number | undefined> | undefined,
	/** All values that are not contained in given list. */
	pageNumber_not_in?: Array<number | undefined> | undefined,
	/** All values less than the given value. */
	pageNumber_lt?: number | undefined,
	/** All values less than or equal the given value. */
	pageNumber_lte?: number | undefined,
	/** All values greater than the given value. */
	pageNumber_gt?: number | undefined,
	/** All values greater than or equal the given value. */
	pageNumber_gte?: number | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	image?: GraphQLTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References PageMetadata record uniquely */
["PageMetadataWhereUniqueInput"]: {
		id?: string | undefined,
	title?: string | undefined,
	slug?: string | undefined
};
	["Project"]: {
	__typename: "Project",
	/** System stage field */
	stage: GraphQLTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<GraphQLTypes["Project"]>,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: GraphQLTypes["DateTime"],
	/** The time the document was created */
	createdAt: GraphQLTypes["DateTime"],
	/** The unique identifier */
	id: string,
	name: string,
	slug?: string | undefined,
	description: string,
	tags: Array<string>,
	demo?: string | undefined,
	sourceCode?: string | undefined,
	/** User that last published this document */
	publishedBy?: GraphQLTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: GraphQLTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: GraphQLTypes["User"] | undefined,
	/** Add one or more images of the project  */
	image: Array<GraphQLTypes["Asset"]>,
	scheduledIn: Array<GraphQLTypes["ScheduledOperation"]>,
	/** List of Project versions */
	history: Array<GraphQLTypes["Version"]>
};
	["ProjectConnectInput"]: {
		/** Document to connect */
	where: GraphQLTypes["ProjectWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: GraphQLTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["ProjectConnection"]: {
	__typename: "ProjectConnection",
	/** Information to aid in pagination. */
	pageInfo: GraphQLTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<GraphQLTypes["ProjectEdge"]>,
	aggregate: GraphQLTypes["Aggregate"]
};
	["ProjectCreateInput"]: {
		updatedAt?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	name: string,
	slug?: string | undefined,
	description: string,
	tags?: Array<string> | undefined,
	demo?: string | undefined,
	sourceCode?: string | undefined,
	image: GraphQLTypes["AssetCreateManyInlineInput"]
};
	["ProjectCreateManyInlineInput"]: {
		/** Create and connect multiple existing Project documents */
	create?: Array<GraphQLTypes["ProjectCreateInput"]> | undefined,
	/** Connect multiple existing Project documents */
	connect?: Array<GraphQLTypes["ProjectWhereUniqueInput"]> | undefined
};
	["ProjectCreateOneInlineInput"]: {
		/** Create and connect one Project document */
	create?: GraphQLTypes["ProjectCreateInput"] | undefined,
	/** Connect one existing Project document */
	connect?: GraphQLTypes["ProjectWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["ProjectEdge"]: {
	__typename: "ProjectEdge",
	/** The item at the end of the edge. */
	node: GraphQLTypes["Project"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["ProjectManyWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["ProjectWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["ProjectWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["ProjectWhereInput"]> | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	slug?: string | undefined,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	slug_contains?: string | undefined,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	/** Matches if the field array contains *all* items provided to the filter and order does match */
	tags?: Array<string> | undefined,
	/** Matches if the field array does not contains *all* items provided to the filter or order does not match */
	tags_not?: Array<string> | undefined,
	/** Matches if the field array contains *all* items provided to the filter */
	tags_contains_all?: Array<string> | undefined,
	/** Matches if the field array contains at least one item provided to the filter */
	tags_contains_some?: Array<string> | undefined,
	/** Matches if the field array does not contain any of the items provided to the filter */
	tags_contains_none?: Array<string> | undefined,
	demo?: string | undefined,
	/** All values that are not equal to given value. */
	demo_not?: string | undefined,
	/** All values that are contained in given list. */
	demo_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	demo_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	demo_contains?: string | undefined,
	/** All values not containing the given string. */
	demo_not_contains?: string | undefined,
	/** All values starting with the given string. */
	demo_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	demo_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	demo_ends_with?: string | undefined,
	/** All values not ending with the given string */
	demo_not_ends_with?: string | undefined,
	sourceCode?: string | undefined,
	/** All values that are not equal to given value. */
	sourceCode_not?: string | undefined,
	/** All values that are contained in given list. */
	sourceCode_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	sourceCode_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	sourceCode_contains?: string | undefined,
	/** All values not containing the given string. */
	sourceCode_not_contains?: string | undefined,
	/** All values starting with the given string. */
	sourceCode_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	sourceCode_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	sourceCode_ends_with?: string | undefined,
	/** All values not ending with the given string */
	sourceCode_not_ends_with?: string | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	image_every?: GraphQLTypes["AssetWhereInput"] | undefined,
	image_some?: GraphQLTypes["AssetWhereInput"] | undefined,
	image_none?: GraphQLTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	["ProjectOrderByInput"]: ProjectOrderByInput;
	["ProjectUpdateInput"]: {
		name?: string | undefined,
	slug?: string | undefined,
	description?: string | undefined,
	tags?: Array<string> | undefined,
	demo?: string | undefined,
	sourceCode?: string | undefined,
	image?: GraphQLTypes["AssetUpdateManyInlineInput"] | undefined
};
	["ProjectUpdateManyInlineInput"]: {
		/** Create and connect multiple Project documents */
	create?: Array<GraphQLTypes["ProjectCreateInput"]> | undefined,
	/** Connect multiple existing Project documents */
	connect?: Array<GraphQLTypes["ProjectConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing Project documents */
	set?: Array<GraphQLTypes["ProjectWhereUniqueInput"]> | undefined,
	/** Update multiple Project documents */
	update?: Array<GraphQLTypes["ProjectUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple Project documents */
	upsert?: Array<GraphQLTypes["ProjectUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple Project documents */
	disconnect?: Array<GraphQLTypes["ProjectWhereUniqueInput"]> | undefined,
	/** Delete multiple Project documents */
	delete?: Array<GraphQLTypes["ProjectWhereUniqueInput"]> | undefined
};
	["ProjectUpdateManyInput"]: {
		description?: string | undefined,
	tags?: Array<string> | undefined,
	demo?: string | undefined,
	sourceCode?: string | undefined
};
	["ProjectUpdateManyWithNestedWhereInput"]: {
		/** Document search */
	where: GraphQLTypes["ProjectWhereInput"],
	/** Update many input */
	data: GraphQLTypes["ProjectUpdateManyInput"]
};
	["ProjectUpdateOneInlineInput"]: {
		/** Create and connect one Project document */
	create?: GraphQLTypes["ProjectCreateInput"] | undefined,
	/** Update single Project document */
	update?: GraphQLTypes["ProjectUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single Project document */
	upsert?: GraphQLTypes["ProjectUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing Project document */
	connect?: GraphQLTypes["ProjectWhereUniqueInput"] | undefined,
	/** Disconnect currently connected Project document */
	disconnect?: boolean | undefined,
	/** Delete currently connected Project document */
	delete?: boolean | undefined
};
	["ProjectUpdateWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["ProjectWhereUniqueInput"],
	/** Document to update */
	data: GraphQLTypes["ProjectUpdateInput"]
};
	["ProjectUpsertInput"]: {
		/** Create document if it didn't exist */
	create: GraphQLTypes["ProjectCreateInput"],
	/** Update document if it exists */
	update: GraphQLTypes["ProjectUpdateInput"]
};
	["ProjectUpsertWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["ProjectWhereUniqueInput"],
	/** Upsert data */
	data: GraphQLTypes["ProjectUpsertInput"]
};
	/** Identifies documents */
["ProjectWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["ProjectWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["ProjectWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["ProjectWhereInput"]> | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	slug?: string | undefined,
	/** All values that are not equal to given value. */
	slug_not?: string | undefined,
	/** All values that are contained in given list. */
	slug_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	slug_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	slug_contains?: string | undefined,
	/** All values not containing the given string. */
	slug_not_contains?: string | undefined,
	/** All values starting with the given string. */
	slug_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	slug_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	slug_ends_with?: string | undefined,
	/** All values not ending with the given string */
	slug_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	/** Matches if the field array contains *all* items provided to the filter and order does match */
	tags?: Array<string> | undefined,
	/** Matches if the field array does not contains *all* items provided to the filter or order does not match */
	tags_not?: Array<string> | undefined,
	/** Matches if the field array contains *all* items provided to the filter */
	tags_contains_all?: Array<string> | undefined,
	/** Matches if the field array contains at least one item provided to the filter */
	tags_contains_some?: Array<string> | undefined,
	/** Matches if the field array does not contain any of the items provided to the filter */
	tags_contains_none?: Array<string> | undefined,
	demo?: string | undefined,
	/** All values that are not equal to given value. */
	demo_not?: string | undefined,
	/** All values that are contained in given list. */
	demo_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	demo_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	demo_contains?: string | undefined,
	/** All values not containing the given string. */
	demo_not_contains?: string | undefined,
	/** All values starting with the given string. */
	demo_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	demo_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	demo_ends_with?: string | undefined,
	/** All values not ending with the given string */
	demo_not_ends_with?: string | undefined,
	sourceCode?: string | undefined,
	/** All values that are not equal to given value. */
	sourceCode_not?: string | undefined,
	/** All values that are contained in given list. */
	sourceCode_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	sourceCode_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	sourceCode_contains?: string | undefined,
	/** All values not containing the given string. */
	sourceCode_not_contains?: string | undefined,
	/** All values starting with the given string. */
	sourceCode_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	sourceCode_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	sourceCode_ends_with?: string | undefined,
	/** All values not ending with the given string */
	sourceCode_not_ends_with?: string | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	image_every?: GraphQLTypes["AssetWhereInput"] | undefined,
	image_some?: GraphQLTypes["AssetWhereInput"] | undefined,
	image_none?: GraphQLTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References Project record uniquely */
["ProjectWhereUniqueInput"]: {
		id?: string | undefined,
	name?: string | undefined,
	slug?: string | undefined
};
	["PublishLocaleInput"]: {
		/** Locales to publish */
	locale: GraphQLTypes["Locale"],
	/** Stages to publish selected locales to */
	stages: Array<GraphQLTypes["Stage"]>
};
	["Query"]: {
	__typename: "Query",
	/** Fetches an object given its ID */
	node?: GraphQLTypes["Node"] | undefined,
	/** Retrieve multiple users */
	users: Array<GraphQLTypes["User"]>,
	/** Retrieve a single user */
	user?: GraphQLTypes["User"] | undefined,
	/** Retrieve multiple users using the Relay connection interface */
	usersConnection: GraphQLTypes["UserConnection"],
	/** Retrieve multiple assets */
	assets: Array<GraphQLTypes["Asset"]>,
	/** Retrieve a single asset */
	asset?: GraphQLTypes["Asset"] | undefined,
	/** Retrieve multiple assets using the Relay connection interface */
	assetsConnection: GraphQLTypes["AssetConnection"],
	/** Retrieve document version */
	assetVersion?: GraphQLTypes["DocumentVersion"] | undefined,
	/** Retrieve multiple scheduledOperations */
	scheduledOperations: Array<GraphQLTypes["ScheduledOperation"]>,
	/** Retrieve a single scheduledOperation */
	scheduledOperation?: GraphQLTypes["ScheduledOperation"] | undefined,
	/** Retrieve multiple scheduledOperations using the Relay connection interface */
	scheduledOperationsConnection: GraphQLTypes["ScheduledOperationConnection"],
	/** Retrieve multiple scheduledReleases */
	scheduledReleases: Array<GraphQLTypes["ScheduledRelease"]>,
	/** Retrieve a single scheduledRelease */
	scheduledRelease?: GraphQLTypes["ScheduledRelease"] | undefined,
	/** Retrieve multiple scheduledReleases using the Relay connection interface */
	scheduledReleasesConnection: GraphQLTypes["ScheduledReleaseConnection"],
	/** Retrieve multiple projects */
	projects: Array<GraphQLTypes["Project"]>,
	/** Retrieve a single project */
	project?: GraphQLTypes["Project"] | undefined,
	/** Retrieve multiple projects using the Relay connection interface */
	projectsConnection: GraphQLTypes["ProjectConnection"],
	/** Retrieve document version */
	projectVersion?: GraphQLTypes["DocumentVersion"] | undefined,
	/** Retrieve multiple socials */
	socials: Array<GraphQLTypes["Social"]>,
	/** Retrieve a single social */
	social?: GraphQLTypes["Social"] | undefined,
	/** Retrieve multiple socials using the Relay connection interface */
	socialsConnection: GraphQLTypes["SocialConnection"],
	/** Retrieve document version */
	socialVersion?: GraphQLTypes["DocumentVersion"] | undefined,
	/** Retrieve multiple pagesMetadata */
	pagesMetadata: Array<GraphQLTypes["PageMetadata"]>,
	/** Retrieve a single pageMetadata */
	pageMetadata?: GraphQLTypes["PageMetadata"] | undefined,
	/** Retrieve multiple pagesMetadata using the Relay connection interface */
	pagesMetadataConnection: GraphQLTypes["PageMetadataConnection"],
	/** Retrieve document version */
	pageMetadataVersion?: GraphQLTypes["DocumentVersion"] | undefined,
	/** Retrieve multiple skills */
	skills: Array<GraphQLTypes["Skill"]>,
	/** Retrieve a single skill */
	skill?: GraphQLTypes["Skill"] | undefined,
	/** Retrieve multiple skills using the Relay connection interface */
	skillsConnection: GraphQLTypes["SkillConnection"],
	/** Retrieve document version */
	skillVersion?: GraphQLTypes["DocumentVersion"] | undefined
};
	/** Representing a RGBA color value: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba() */
["RGBA"]: {
	__typename: "RGBA",
	r: GraphQLTypes["RGBAHue"],
	g: GraphQLTypes["RGBAHue"],
	b: GraphQLTypes["RGBAHue"],
	a: GraphQLTypes["RGBATransparency"]
};
	["RGBAHue"]: "scalar" & { name: "RGBAHue" };
	/** Input type representing a RGBA color value: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#rgb()_and_rgba() */
["RGBAInput"]: {
		r: GraphQLTypes["RGBAHue"],
	g: GraphQLTypes["RGBAHue"],
	b: GraphQLTypes["RGBAHue"],
	a: GraphQLTypes["RGBATransparency"]
};
	["RGBATransparency"]: "scalar" & { name: "RGBATransparency" };
	/** Custom type representing a rich text value comprising of raw rich text ast, html, markdown and text values */
["RichText"]: {
	__typename: "RichText",
	/** Returns AST representation */
	raw: GraphQLTypes["RichTextAST"],
	/** Returns HTMl representation */
	html: string,
	/** Returns Markdown representation */
	markdown: string,
	/** Returns plain-text contents of RichText */
	text: string
};
	/** Slate-compatible RichText AST */
["RichTextAST"]: "scalar" & { name: "RichTextAST" };
	/** Scheduled Operation system model */
["ScheduledOperation"]: {
	__typename: "ScheduledOperation",
	/** System stage field */
	stage: GraphQLTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<GraphQLTypes["ScheduledOperation"]>,
	/** Raw operation payload including all details, this field is subject to change */
	rawPayload: GraphQLTypes["Json"],
	/** Operation error message */
	errorMessage?: string | undefined,
	/** Operation description */
	description?: string | undefined,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: GraphQLTypes["DateTime"],
	/** The time the document was created */
	createdAt: GraphQLTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** The release this operation is scheduled for */
	release?: GraphQLTypes["ScheduledRelease"] | undefined,
	/** User that last published this document */
	publishedBy?: GraphQLTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: GraphQLTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: GraphQLTypes["User"] | undefined,
	/** operation Status */
	status: GraphQLTypes["ScheduledOperationStatus"],
	affectedDocuments: Array<GraphQLTypes["ScheduledOperationAffectedDocument"]>
};
	["ScheduledOperationAffectedDocument"]:{
        	__typename:"Asset" | "PageMetadata" | "Project" | "Skill" | "Social"
        	['...on Asset']: '__union' & GraphQLTypes["Asset"];
	['...on PageMetadata']: '__union' & GraphQLTypes["PageMetadata"];
	['...on Project']: '__union' & GraphQLTypes["Project"];
	['...on Skill']: '__union' & GraphQLTypes["Skill"];
	['...on Social']: '__union' & GraphQLTypes["Social"];
};
	["ScheduledOperationConnectInput"]: {
		/** Document to connect */
	where: GraphQLTypes["ScheduledOperationWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: GraphQLTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["ScheduledOperationConnection"]: {
	__typename: "ScheduledOperationConnection",
	/** Information to aid in pagination. */
	pageInfo: GraphQLTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<GraphQLTypes["ScheduledOperationEdge"]>,
	aggregate: GraphQLTypes["Aggregate"]
};
	["ScheduledOperationCreateManyInlineInput"]: {
		/** Connect multiple existing ScheduledOperation documents */
	connect?: Array<GraphQLTypes["ScheduledOperationWhereUniqueInput"]> | undefined
};
	["ScheduledOperationCreateOneInlineInput"]: {
		/** Connect one existing ScheduledOperation document */
	connect?: GraphQLTypes["ScheduledOperationWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["ScheduledOperationEdge"]: {
	__typename: "ScheduledOperationEdge",
	/** The item at the end of the edge. */
	node: GraphQLTypes["ScheduledOperation"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["ScheduledOperationManyWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["ScheduledOperationWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["ScheduledOperationWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["ScheduledOperationWhereInput"]> | undefined,
	errorMessage?: string | undefined,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	release?: GraphQLTypes["ScheduledReleaseWhereInput"] | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	status?: GraphQLTypes["ScheduledOperationStatus"] | undefined,
	/** All values that are not equal to given value. */
	status_not?: GraphQLTypes["ScheduledOperationStatus"] | undefined,
	/** All values that are contained in given list. */
	status_in?: Array<GraphQLTypes["ScheduledOperationStatus"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	status_not_in?: Array<GraphQLTypes["ScheduledOperationStatus"] | undefined> | undefined
};
	["ScheduledOperationOrderByInput"]: ScheduledOperationOrderByInput;
	/** System Scheduled Operation Status */
["ScheduledOperationStatus"]: ScheduledOperationStatus;
	["ScheduledOperationUpdateManyInlineInput"]: {
		/** Connect multiple existing ScheduledOperation documents */
	connect?: Array<GraphQLTypes["ScheduledOperationConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing ScheduledOperation documents */
	set?: Array<GraphQLTypes["ScheduledOperationWhereUniqueInput"]> | undefined,
	/** Disconnect multiple ScheduledOperation documents */
	disconnect?: Array<GraphQLTypes["ScheduledOperationWhereUniqueInput"]> | undefined
};
	["ScheduledOperationUpdateOneInlineInput"]: {
		/** Connect existing ScheduledOperation document */
	connect?: GraphQLTypes["ScheduledOperationWhereUniqueInput"] | undefined,
	/** Disconnect currently connected ScheduledOperation document */
	disconnect?: boolean | undefined
};
	/** Identifies documents */
["ScheduledOperationWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["ScheduledOperationWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["ScheduledOperationWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["ScheduledOperationWhereInput"]> | undefined,
	errorMessage?: string | undefined,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	release?: GraphQLTypes["ScheduledReleaseWhereInput"] | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	status?: GraphQLTypes["ScheduledOperationStatus"] | undefined,
	/** All values that are not equal to given value. */
	status_not?: GraphQLTypes["ScheduledOperationStatus"] | undefined,
	/** All values that are contained in given list. */
	status_in?: Array<GraphQLTypes["ScheduledOperationStatus"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	status_not_in?: Array<GraphQLTypes["ScheduledOperationStatus"] | undefined> | undefined
};
	/** References ScheduledOperation record uniquely */
["ScheduledOperationWhereUniqueInput"]: {
		id?: string | undefined
};
	/** Scheduled Release system model */
["ScheduledRelease"]: {
	__typename: "ScheduledRelease",
	/** System stage field */
	stage: GraphQLTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<GraphQLTypes["ScheduledRelease"]>,
	/** Release date and time */
	releaseAt?: GraphQLTypes["DateTime"] | undefined,
	/** Whether scheduled release is implicit */
	isImplicit: boolean,
	/** Whether scheduled release should be run */
	isActive: boolean,
	/** Release error message */
	errorMessage?: string | undefined,
	/** Release description */
	description?: string | undefined,
	/** Release Title */
	title?: string | undefined,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: GraphQLTypes["DateTime"],
	/** The time the document was created */
	createdAt: GraphQLTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** Operations to run with this release */
	operations: Array<GraphQLTypes["ScheduledOperation"]>,
	/** User that last published this document */
	publishedBy?: GraphQLTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: GraphQLTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: GraphQLTypes["User"] | undefined,
	/** Release Status */
	status: GraphQLTypes["ScheduledReleaseStatus"]
};
	["ScheduledReleaseConnectInput"]: {
		/** Document to connect */
	where: GraphQLTypes["ScheduledReleaseWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: GraphQLTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["ScheduledReleaseConnection"]: {
	__typename: "ScheduledReleaseConnection",
	/** Information to aid in pagination. */
	pageInfo: GraphQLTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<GraphQLTypes["ScheduledReleaseEdge"]>,
	aggregate: GraphQLTypes["Aggregate"]
};
	["ScheduledReleaseCreateInput"]: {
		releaseAt?: GraphQLTypes["DateTime"] | undefined,
	isActive?: boolean | undefined,
	errorMessage?: string | undefined,
	description?: string | undefined,
	title?: string | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined
};
	["ScheduledReleaseCreateManyInlineInput"]: {
		/** Create and connect multiple existing ScheduledRelease documents */
	create?: Array<GraphQLTypes["ScheduledReleaseCreateInput"]> | undefined,
	/** Connect multiple existing ScheduledRelease documents */
	connect?: Array<GraphQLTypes["ScheduledReleaseWhereUniqueInput"]> | undefined
};
	["ScheduledReleaseCreateOneInlineInput"]: {
		/** Create and connect one ScheduledRelease document */
	create?: GraphQLTypes["ScheduledReleaseCreateInput"] | undefined,
	/** Connect one existing ScheduledRelease document */
	connect?: GraphQLTypes["ScheduledReleaseWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["ScheduledReleaseEdge"]: {
	__typename: "ScheduledReleaseEdge",
	/** The item at the end of the edge. */
	node: GraphQLTypes["ScheduledRelease"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["ScheduledReleaseManyWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["ScheduledReleaseWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["ScheduledReleaseWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["ScheduledReleaseWhereInput"]> | undefined,
	releaseAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	releaseAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	releaseAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	releaseAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	releaseAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	releaseAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	releaseAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	releaseAt_gte?: GraphQLTypes["DateTime"] | undefined,
	isImplicit?: boolean | undefined,
	/** All values that are not equal to given value. */
	isImplicit_not?: boolean | undefined,
	isActive?: boolean | undefined,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined,
	errorMessage?: string | undefined,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	title?: string | undefined,
	/** All values that are not equal to given value. */
	title_not?: string | undefined,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	title_contains?: string | undefined,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	operations_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	operations_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	operations_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	status?: GraphQLTypes["ScheduledReleaseStatus"] | undefined,
	/** All values that are not equal to given value. */
	status_not?: GraphQLTypes["ScheduledReleaseStatus"] | undefined,
	/** All values that are contained in given list. */
	status_in?: Array<GraphQLTypes["ScheduledReleaseStatus"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	status_not_in?: Array<GraphQLTypes["ScheduledReleaseStatus"] | undefined> | undefined
};
	["ScheduledReleaseOrderByInput"]: ScheduledReleaseOrderByInput;
	/** System Scheduled Release Status */
["ScheduledReleaseStatus"]: ScheduledReleaseStatus;
	["ScheduledReleaseUpdateInput"]: {
		releaseAt?: GraphQLTypes["DateTime"] | undefined,
	isActive?: boolean | undefined,
	errorMessage?: string | undefined,
	description?: string | undefined,
	title?: string | undefined
};
	["ScheduledReleaseUpdateManyInlineInput"]: {
		/** Create and connect multiple ScheduledRelease documents */
	create?: Array<GraphQLTypes["ScheduledReleaseCreateInput"]> | undefined,
	/** Connect multiple existing ScheduledRelease documents */
	connect?: Array<GraphQLTypes["ScheduledReleaseConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing ScheduledRelease documents */
	set?: Array<GraphQLTypes["ScheduledReleaseWhereUniqueInput"]> | undefined,
	/** Update multiple ScheduledRelease documents */
	update?: Array<GraphQLTypes["ScheduledReleaseUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple ScheduledRelease documents */
	upsert?: Array<GraphQLTypes["ScheduledReleaseUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple ScheduledRelease documents */
	disconnect?: Array<GraphQLTypes["ScheduledReleaseWhereUniqueInput"]> | undefined,
	/** Delete multiple ScheduledRelease documents */
	delete?: Array<GraphQLTypes["ScheduledReleaseWhereUniqueInput"]> | undefined
};
	["ScheduledReleaseUpdateManyInput"]: {
		releaseAt?: GraphQLTypes["DateTime"] | undefined,
	isActive?: boolean | undefined,
	errorMessage?: string | undefined,
	description?: string | undefined,
	title?: string | undefined
};
	["ScheduledReleaseUpdateManyWithNestedWhereInput"]: {
		/** Document search */
	where: GraphQLTypes["ScheduledReleaseWhereInput"],
	/** Update many input */
	data: GraphQLTypes["ScheduledReleaseUpdateManyInput"]
};
	["ScheduledReleaseUpdateOneInlineInput"]: {
		/** Create and connect one ScheduledRelease document */
	create?: GraphQLTypes["ScheduledReleaseCreateInput"] | undefined,
	/** Update single ScheduledRelease document */
	update?: GraphQLTypes["ScheduledReleaseUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single ScheduledRelease document */
	upsert?: GraphQLTypes["ScheduledReleaseUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing ScheduledRelease document */
	connect?: GraphQLTypes["ScheduledReleaseWhereUniqueInput"] | undefined,
	/** Disconnect currently connected ScheduledRelease document */
	disconnect?: boolean | undefined,
	/** Delete currently connected ScheduledRelease document */
	delete?: boolean | undefined
};
	["ScheduledReleaseUpdateWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["ScheduledReleaseWhereUniqueInput"],
	/** Document to update */
	data: GraphQLTypes["ScheduledReleaseUpdateInput"]
};
	["ScheduledReleaseUpsertInput"]: {
		/** Create document if it didn't exist */
	create: GraphQLTypes["ScheduledReleaseCreateInput"],
	/** Update document if it exists */
	update: GraphQLTypes["ScheduledReleaseUpdateInput"]
};
	["ScheduledReleaseUpsertWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["ScheduledReleaseWhereUniqueInput"],
	/** Upsert data */
	data: GraphQLTypes["ScheduledReleaseUpsertInput"]
};
	/** Identifies documents */
["ScheduledReleaseWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["ScheduledReleaseWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["ScheduledReleaseWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["ScheduledReleaseWhereInput"]> | undefined,
	releaseAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	releaseAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	releaseAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	releaseAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	releaseAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	releaseAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	releaseAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	releaseAt_gte?: GraphQLTypes["DateTime"] | undefined,
	isImplicit?: boolean | undefined,
	/** All values that are not equal to given value. */
	isImplicit_not?: boolean | undefined,
	isActive?: boolean | undefined,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined,
	errorMessage?: string | undefined,
	/** All values that are not equal to given value. */
	errorMessage_not?: string | undefined,
	/** All values that are contained in given list. */
	errorMessage_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	errorMessage_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	errorMessage_contains?: string | undefined,
	/** All values not containing the given string. */
	errorMessage_not_contains?: string | undefined,
	/** All values starting with the given string. */
	errorMessage_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	errorMessage_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	errorMessage_ends_with?: string | undefined,
	/** All values not ending with the given string */
	errorMessage_not_ends_with?: string | undefined,
	description?: string | undefined,
	/** All values that are not equal to given value. */
	description_not?: string | undefined,
	/** All values that are contained in given list. */
	description_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	description_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	description_contains?: string | undefined,
	/** All values not containing the given string. */
	description_not_contains?: string | undefined,
	/** All values starting with the given string. */
	description_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	description_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	description_ends_with?: string | undefined,
	/** All values not ending with the given string */
	description_not_ends_with?: string | undefined,
	title?: string | undefined,
	/** All values that are not equal to given value. */
	title_not?: string | undefined,
	/** All values that are contained in given list. */
	title_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	title_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	title_contains?: string | undefined,
	/** All values not containing the given string. */
	title_not_contains?: string | undefined,
	/** All values starting with the given string. */
	title_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	title_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	title_ends_with?: string | undefined,
	/** All values not ending with the given string */
	title_not_ends_with?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	operations_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	operations_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	operations_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	status?: GraphQLTypes["ScheduledReleaseStatus"] | undefined,
	/** All values that are not equal to given value. */
	status_not?: GraphQLTypes["ScheduledReleaseStatus"] | undefined,
	/** All values that are contained in given list. */
	status_in?: Array<GraphQLTypes["ScheduledReleaseStatus"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	status_not_in?: Array<GraphQLTypes["ScheduledReleaseStatus"] | undefined> | undefined
};
	/** References ScheduledRelease record uniquely */
["ScheduledReleaseWhereUniqueInput"]: {
		id?: string | undefined
};
	["Skill"]: {
	__typename: "Skill",
	/** System stage field */
	stage: GraphQLTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<GraphQLTypes["Skill"]>,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: GraphQLTypes["DateTime"],
	/** The time the document was created */
	createdAt: GraphQLTypes["DateTime"],
	/** The unique identifier */
	id: string,
	name: string,
	/** User that last published this document */
	publishedBy?: GraphQLTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: GraphQLTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: GraphQLTypes["User"] | undefined,
	icon?: GraphQLTypes["Asset"] | undefined,
	scheduledIn: Array<GraphQLTypes["ScheduledOperation"]>,
	/** List of Skill versions */
	history: Array<GraphQLTypes["Version"]>
};
	["SkillConnectInput"]: {
		/** Document to connect */
	where: GraphQLTypes["SkillWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: GraphQLTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["SkillConnection"]: {
	__typename: "SkillConnection",
	/** Information to aid in pagination. */
	pageInfo: GraphQLTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<GraphQLTypes["SkillEdge"]>,
	aggregate: GraphQLTypes["Aggregate"]
};
	["SkillCreateInput"]: {
		updatedAt?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	name: string,
	icon?: GraphQLTypes["AssetCreateOneInlineInput"] | undefined
};
	["SkillCreateManyInlineInput"]: {
		/** Create and connect multiple existing Skill documents */
	create?: Array<GraphQLTypes["SkillCreateInput"]> | undefined,
	/** Connect multiple existing Skill documents */
	connect?: Array<GraphQLTypes["SkillWhereUniqueInput"]> | undefined
};
	["SkillCreateOneInlineInput"]: {
		/** Create and connect one Skill document */
	create?: GraphQLTypes["SkillCreateInput"] | undefined,
	/** Connect one existing Skill document */
	connect?: GraphQLTypes["SkillWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["SkillEdge"]: {
	__typename: "SkillEdge",
	/** The item at the end of the edge. */
	node: GraphQLTypes["Skill"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["SkillManyWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["SkillWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["SkillWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["SkillWhereInput"]> | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	icon?: GraphQLTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	["SkillOrderByInput"]: SkillOrderByInput;
	["SkillUpdateInput"]: {
		name?: string | undefined,
	icon?: GraphQLTypes["AssetUpdateOneInlineInput"] | undefined
};
	["SkillUpdateManyInlineInput"]: {
		/** Create and connect multiple Skill documents */
	create?: Array<GraphQLTypes["SkillCreateInput"]> | undefined,
	/** Connect multiple existing Skill documents */
	connect?: Array<GraphQLTypes["SkillConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing Skill documents */
	set?: Array<GraphQLTypes["SkillWhereUniqueInput"]> | undefined,
	/** Update multiple Skill documents */
	update?: Array<GraphQLTypes["SkillUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple Skill documents */
	upsert?: Array<GraphQLTypes["SkillUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple Skill documents */
	disconnect?: Array<GraphQLTypes["SkillWhereUniqueInput"]> | undefined,
	/** Delete multiple Skill documents */
	delete?: Array<GraphQLTypes["SkillWhereUniqueInput"]> | undefined
};
	["SkillUpdateManyInput"]: {
		/** No fields in updateMany data input */
	_?: string | undefined
};
	["SkillUpdateManyWithNestedWhereInput"]: {
		/** Document search */
	where: GraphQLTypes["SkillWhereInput"],
	/** Update many input */
	data: GraphQLTypes["SkillUpdateManyInput"]
};
	["SkillUpdateOneInlineInput"]: {
		/** Create and connect one Skill document */
	create?: GraphQLTypes["SkillCreateInput"] | undefined,
	/** Update single Skill document */
	update?: GraphQLTypes["SkillUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single Skill document */
	upsert?: GraphQLTypes["SkillUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing Skill document */
	connect?: GraphQLTypes["SkillWhereUniqueInput"] | undefined,
	/** Disconnect currently connected Skill document */
	disconnect?: boolean | undefined,
	/** Delete currently connected Skill document */
	delete?: boolean | undefined
};
	["SkillUpdateWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["SkillWhereUniqueInput"],
	/** Document to update */
	data: GraphQLTypes["SkillUpdateInput"]
};
	["SkillUpsertInput"]: {
		/** Create document if it didn't exist */
	create: GraphQLTypes["SkillCreateInput"],
	/** Update document if it exists */
	update: GraphQLTypes["SkillUpdateInput"]
};
	["SkillUpsertWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["SkillWhereUniqueInput"],
	/** Upsert data */
	data: GraphQLTypes["SkillUpsertInput"]
};
	/** Identifies documents */
["SkillWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["SkillWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["SkillWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["SkillWhereInput"]> | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	icon?: GraphQLTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References Skill record uniquely */
["SkillWhereUniqueInput"]: {
		id?: string | undefined,
	name?: string | undefined
};
	["Social"]: {
	__typename: "Social",
	/** System stage field */
	stage: GraphQLTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<GraphQLTypes["Social"]>,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: GraphQLTypes["DateTime"],
	/** The time the document was created */
	createdAt: GraphQLTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** Social media name */
	name: string,
	/** Social media link */
	url: string,
	/** Social media color */
	color?: GraphQLTypes["Color"] | undefined,
	/** User that last published this document */
	publishedBy?: GraphQLTypes["User"] | undefined,
	/** User that last updated this document */
	updatedBy?: GraphQLTypes["User"] | undefined,
	/** User that created this document */
	createdBy?: GraphQLTypes["User"] | undefined,
	/** Social media logo */
	image: GraphQLTypes["Asset"],
	scheduledIn: Array<GraphQLTypes["ScheduledOperation"]>,
	/** List of Social versions */
	history: Array<GraphQLTypes["Version"]>
};
	["SocialConnectInput"]: {
		/** Document to connect */
	where: GraphQLTypes["SocialWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: GraphQLTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["SocialConnection"]: {
	__typename: "SocialConnection",
	/** Information to aid in pagination. */
	pageInfo: GraphQLTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<GraphQLTypes["SocialEdge"]>,
	aggregate: GraphQLTypes["Aggregate"]
};
	["SocialCreateInput"]: {
		updatedAt?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	name: string,
	url: string,
	color?: GraphQLTypes["ColorInput"] | undefined,
	image: GraphQLTypes["AssetCreateOneInlineInput"]
};
	["SocialCreateManyInlineInput"]: {
		/** Create and connect multiple existing Social documents */
	create?: Array<GraphQLTypes["SocialCreateInput"]> | undefined,
	/** Connect multiple existing Social documents */
	connect?: Array<GraphQLTypes["SocialWhereUniqueInput"]> | undefined
};
	["SocialCreateOneInlineInput"]: {
		/** Create and connect one Social document */
	create?: GraphQLTypes["SocialCreateInput"] | undefined,
	/** Connect one existing Social document */
	connect?: GraphQLTypes["SocialWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["SocialEdge"]: {
	__typename: "SocialEdge",
	/** The item at the end of the edge. */
	node: GraphQLTypes["Social"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** Identifies documents */
["SocialManyWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["SocialWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["SocialWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["SocialWhereInput"]> | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	url?: string | undefined,
	/** All values that are not equal to given value. */
	url_not?: string | undefined,
	/** All values that are contained in given list. */
	url_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	url_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	url_contains?: string | undefined,
	/** All values not containing the given string. */
	url_not_contains?: string | undefined,
	/** All values starting with the given string. */
	url_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	url_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	url_ends_with?: string | undefined,
	/** All values not ending with the given string */
	url_not_ends_with?: string | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	image?: GraphQLTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	["SocialOrderByInput"]: SocialOrderByInput;
	["SocialUpdateInput"]: {
		name?: string | undefined,
	url?: string | undefined,
	color?: GraphQLTypes["ColorInput"] | undefined,
	image?: GraphQLTypes["AssetUpdateOneInlineInput"] | undefined
};
	["SocialUpdateManyInlineInput"]: {
		/** Create and connect multiple Social documents */
	create?: Array<GraphQLTypes["SocialCreateInput"]> | undefined,
	/** Connect multiple existing Social documents */
	connect?: Array<GraphQLTypes["SocialConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing Social documents */
	set?: Array<GraphQLTypes["SocialWhereUniqueInput"]> | undefined,
	/** Update multiple Social documents */
	update?: Array<GraphQLTypes["SocialUpdateWithNestedWhereUniqueInput"]> | undefined,
	/** Upsert multiple Social documents */
	upsert?: Array<GraphQLTypes["SocialUpsertWithNestedWhereUniqueInput"]> | undefined,
	/** Disconnect multiple Social documents */
	disconnect?: Array<GraphQLTypes["SocialWhereUniqueInput"]> | undefined,
	/** Delete multiple Social documents */
	delete?: Array<GraphQLTypes["SocialWhereUniqueInput"]> | undefined
};
	["SocialUpdateManyInput"]: {
		name?: string | undefined,
	color?: GraphQLTypes["ColorInput"] | undefined
};
	["SocialUpdateManyWithNestedWhereInput"]: {
		/** Document search */
	where: GraphQLTypes["SocialWhereInput"],
	/** Update many input */
	data: GraphQLTypes["SocialUpdateManyInput"]
};
	["SocialUpdateOneInlineInput"]: {
		/** Create and connect one Social document */
	create?: GraphQLTypes["SocialCreateInput"] | undefined,
	/** Update single Social document */
	update?: GraphQLTypes["SocialUpdateWithNestedWhereUniqueInput"] | undefined,
	/** Upsert single Social document */
	upsert?: GraphQLTypes["SocialUpsertWithNestedWhereUniqueInput"] | undefined,
	/** Connect existing Social document */
	connect?: GraphQLTypes["SocialWhereUniqueInput"] | undefined,
	/** Disconnect currently connected Social document */
	disconnect?: boolean | undefined,
	/** Delete currently connected Social document */
	delete?: boolean | undefined
};
	["SocialUpdateWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["SocialWhereUniqueInput"],
	/** Document to update */
	data: GraphQLTypes["SocialUpdateInput"]
};
	["SocialUpsertInput"]: {
		/** Create document if it didn't exist */
	create: GraphQLTypes["SocialCreateInput"],
	/** Update document if it exists */
	update: GraphQLTypes["SocialUpdateInput"]
};
	["SocialUpsertWithNestedWhereUniqueInput"]: {
		/** Unique document search */
	where: GraphQLTypes["SocialWhereUniqueInput"],
	/** Upsert data */
	data: GraphQLTypes["SocialUpsertInput"]
};
	/** Identifies documents */
["SocialWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["SocialWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["SocialWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["SocialWhereInput"]> | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	url?: string | undefined,
	/** All values that are not equal to given value. */
	url_not?: string | undefined,
	/** All values that are contained in given list. */
	url_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	url_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	url_contains?: string | undefined,
	/** All values not containing the given string. */
	url_not_contains?: string | undefined,
	/** All values starting with the given string. */
	url_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	url_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	url_ends_with?: string | undefined,
	/** All values not ending with the given string */
	url_not_ends_with?: string | undefined,
	publishedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	updatedBy?: GraphQLTypes["UserWhereInput"] | undefined,
	createdBy?: GraphQLTypes["UserWhereInput"] | undefined,
	image?: GraphQLTypes["AssetWhereInput"] | undefined,
	scheduledIn_every?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_some?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined,
	scheduledIn_none?: GraphQLTypes["ScheduledOperationWhereInput"] | undefined
};
	/** References Social record uniquely */
["SocialWhereUniqueInput"]: {
		id?: string | undefined,
	url?: string | undefined
};
	/** Stage system enumeration */
["Stage"]: Stage;
	["SystemDateTimeFieldVariation"]: SystemDateTimeFieldVariation;
	["UnpublishLocaleInput"]: {
		/** Locales to unpublish */
	locale: GraphQLTypes["Locale"],
	/** Stages to unpublish selected locales from */
	stages: Array<GraphQLTypes["Stage"]>
};
	/** User system model */
["User"]: {
	__typename: "User",
	/** System stage field */
	stage: GraphQLTypes["Stage"],
	/** Get the document in other stages */
	documentInStages: Array<GraphQLTypes["User"]>,
	/** Flag to determine if user is active or not */
	isActive: boolean,
	/** Profile Picture url */
	picture?: string | undefined,
	/** The username */
	name: string,
	/** The time the document was published. Null on documents in draft stage. */
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** The time the document was updated */
	updatedAt: GraphQLTypes["DateTime"],
	/** The time the document was created */
	createdAt: GraphQLTypes["DateTime"],
	/** The unique identifier */
	id: string,
	/** User Kind. Can be either MEMBER, PAT or PUBLIC */
	kind: GraphQLTypes["UserKind"]
};
	["UserConnectInput"]: {
		/** Document to connect */
	where: GraphQLTypes["UserWhereUniqueInput"],
	/** Allow to specify document position in list of connected documents, will default to appending at end of list */
	position?: GraphQLTypes["ConnectPositionInput"] | undefined
};
	/** A connection to a list of items. */
["UserConnection"]: {
	__typename: "UserConnection",
	/** Information to aid in pagination. */
	pageInfo: GraphQLTypes["PageInfo"],
	/** A list of edges. */
	edges: Array<GraphQLTypes["UserEdge"]>,
	aggregate: GraphQLTypes["Aggregate"]
};
	["UserCreateManyInlineInput"]: {
		/** Connect multiple existing User documents */
	connect?: Array<GraphQLTypes["UserWhereUniqueInput"]> | undefined
};
	["UserCreateOneInlineInput"]: {
		/** Connect one existing User document */
	connect?: GraphQLTypes["UserWhereUniqueInput"] | undefined
};
	/** An edge in a connection. */
["UserEdge"]: {
	__typename: "UserEdge",
	/** The item at the end of the edge. */
	node: GraphQLTypes["User"],
	/** A cursor for use in pagination. */
	cursor: string
};
	/** System User Kind */
["UserKind"]: UserKind;
	/** Identifies documents */
["UserManyWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["UserWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["UserWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["UserWhereInput"]> | undefined,
	isActive?: boolean | undefined,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined,
	picture?: string | undefined,
	/** All values that are not equal to given value. */
	picture_not?: string | undefined,
	/** All values that are contained in given list. */
	picture_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	picture_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	picture_contains?: string | undefined,
	/** All values not containing the given string. */
	picture_not_contains?: string | undefined,
	/** All values starting with the given string. */
	picture_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	picture_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	picture_ends_with?: string | undefined,
	/** All values not ending with the given string */
	picture_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	kind?: GraphQLTypes["UserKind"] | undefined,
	/** All values that are not equal to given value. */
	kind_not?: GraphQLTypes["UserKind"] | undefined,
	/** All values that are contained in given list. */
	kind_in?: Array<GraphQLTypes["UserKind"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	kind_not_in?: Array<GraphQLTypes["UserKind"] | undefined> | undefined
};
	["UserOrderByInput"]: UserOrderByInput;
	["UserUpdateManyInlineInput"]: {
		/** Connect multiple existing User documents */
	connect?: Array<GraphQLTypes["UserConnectInput"]> | undefined,
	/** Override currently-connected documents with multiple existing User documents */
	set?: Array<GraphQLTypes["UserWhereUniqueInput"]> | undefined,
	/** Disconnect multiple User documents */
	disconnect?: Array<GraphQLTypes["UserWhereUniqueInput"]> | undefined
};
	["UserUpdateOneInlineInput"]: {
		/** Connect existing User document */
	connect?: GraphQLTypes["UserWhereUniqueInput"] | undefined,
	/** Disconnect currently connected User document */
	disconnect?: boolean | undefined
};
	/** Identifies documents */
["UserWhereInput"]: {
		/** Contains search across all appropriate fields. */
	_search?: string | undefined,
	/** Logical AND on all given filters. */
	AND?: Array<GraphQLTypes["UserWhereInput"]> | undefined,
	/** Logical OR on all given filters. */
	OR?: Array<GraphQLTypes["UserWhereInput"]> | undefined,
	/** Logical NOT on all given filters combined by AND. */
	NOT?: Array<GraphQLTypes["UserWhereInput"]> | undefined,
	isActive?: boolean | undefined,
	/** All values that are not equal to given value. */
	isActive_not?: boolean | undefined,
	picture?: string | undefined,
	/** All values that are not equal to given value. */
	picture_not?: string | undefined,
	/** All values that are contained in given list. */
	picture_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	picture_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	picture_contains?: string | undefined,
	/** All values not containing the given string. */
	picture_not_contains?: string | undefined,
	/** All values starting with the given string. */
	picture_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	picture_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	picture_ends_with?: string | undefined,
	/** All values not ending with the given string */
	picture_not_ends_with?: string | undefined,
	name?: string | undefined,
	/** All values that are not equal to given value. */
	name_not?: string | undefined,
	/** All values that are contained in given list. */
	name_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	name_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	name_contains?: string | undefined,
	/** All values not containing the given string. */
	name_not_contains?: string | undefined,
	/** All values starting with the given string. */
	name_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	name_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	name_ends_with?: string | undefined,
	/** All values not ending with the given string */
	name_not_ends_with?: string | undefined,
	publishedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	publishedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	publishedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	publishedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	publishedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	publishedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	publishedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	publishedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	updatedAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	updatedAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	updatedAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	updatedAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	updatedAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	updatedAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	updatedAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	updatedAt_gte?: GraphQLTypes["DateTime"] | undefined,
	createdAt?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are not equal to given value. */
	createdAt_not?: GraphQLTypes["DateTime"] | undefined,
	/** All values that are contained in given list. */
	createdAt_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	createdAt_not_in?: Array<GraphQLTypes["DateTime"] | undefined> | undefined,
	/** All values less than the given value. */
	createdAt_lt?: GraphQLTypes["DateTime"] | undefined,
	/** All values less than or equal the given value. */
	createdAt_lte?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than the given value. */
	createdAt_gt?: GraphQLTypes["DateTime"] | undefined,
	/** All values greater than or equal the given value. */
	createdAt_gte?: GraphQLTypes["DateTime"] | undefined,
	id?: string | undefined,
	/** All values that are not equal to given value. */
	id_not?: string | undefined,
	/** All values that are contained in given list. */
	id_in?: Array<string | undefined> | undefined,
	/** All values that are not contained in given list. */
	id_not_in?: Array<string | undefined> | undefined,
	/** All values containing the given string. */
	id_contains?: string | undefined,
	/** All values not containing the given string. */
	id_not_contains?: string | undefined,
	/** All values starting with the given string. */
	id_starts_with?: string | undefined,
	/** All values not starting with the given string. */
	id_not_starts_with?: string | undefined,
	/** All values ending with the given string. */
	id_ends_with?: string | undefined,
	/** All values not ending with the given string */
	id_not_ends_with?: string | undefined,
	kind?: GraphQLTypes["UserKind"] | undefined,
	/** All values that are not equal to given value. */
	kind_not?: GraphQLTypes["UserKind"] | undefined,
	/** All values that are contained in given list. */
	kind_in?: Array<GraphQLTypes["UserKind"] | undefined> | undefined,
	/** All values that are not contained in given list. */
	kind_not_in?: Array<GraphQLTypes["UserKind"] | undefined> | undefined
};
	/** References User record uniquely */
["UserWhereUniqueInput"]: {
		id?: string | undefined
};
	["Version"]: {
	__typename: "Version",
	id: string,
	stage: GraphQLTypes["Stage"],
	revision: number,
	createdAt: GraphQLTypes["DateTime"]
};
	["VersionWhereInput"]: {
		id: string,
	stage: GraphQLTypes["Stage"],
	revision: number
};
	["_FilterKind"]: _FilterKind;
	["_MutationInputFieldKind"]: _MutationInputFieldKind;
	["_MutationKind"]: _MutationKind;
	["_OrderDirection"]: _OrderDirection;
	["_RelationInputCardinality"]: _RelationInputCardinality;
	["_RelationInputKind"]: _RelationInputKind;
	["_RelationKind"]: _RelationKind;
	["_SystemDateTimeFieldVariation"]: _SystemDateTimeFieldVariation
    }
export const enum AssetOrderByInput {
	mimeType_ASC = "mimeType_ASC",
	mimeType_DESC = "mimeType_DESC",
	size_ASC = "size_ASC",
	size_DESC = "size_DESC",
	width_ASC = "width_ASC",
	width_DESC = "width_DESC",
	height_ASC = "height_ASC",
	height_DESC = "height_DESC",
	fileName_ASC = "fileName_ASC",
	fileName_DESC = "fileName_DESC",
	handle_ASC = "handle_ASC",
	handle_DESC = "handle_DESC",
	publishedAt_ASC = "publishedAt_ASC",
	publishedAt_DESC = "publishedAt_DESC",
	updatedAt_ASC = "updatedAt_ASC",
	updatedAt_DESC = "updatedAt_DESC",
	createdAt_ASC = "createdAt_ASC",
	createdAt_DESC = "createdAt_DESC",
	id_ASC = "id_ASC",
	id_DESC = "id_DESC"
}
export const enum DocumentFileTypes {
	jpg = "jpg",
	odp = "odp",
	ods = "ods",
	odt = "odt",
	png = "png",
	svg = "svg",
	txt = "txt",
	webp = "webp",
	docx = "docx",
	pdf = "pdf",
	html = "html",
	doc = "doc",
	xlsx = "xlsx",
	xls = "xls",
	pptx = "pptx",
	ppt = "ppt"
}
export const enum ImageFit {
	clip = "clip",
	crop = "crop",
	scale = "scale",
	max = "max"
}
/** Locale system enumeration */
export const enum Locale {
	en = "en"
}
export const enum PageMetadataOrderByInput {
	publishedAt_ASC = "publishedAt_ASC",
	publishedAt_DESC = "publishedAt_DESC",
	updatedAt_ASC = "updatedAt_ASC",
	updatedAt_DESC = "updatedAt_DESC",
	createdAt_ASC = "createdAt_ASC",
	createdAt_DESC = "createdAt_DESC",
	id_ASC = "id_ASC",
	id_DESC = "id_DESC",
	title_ASC = "title_ASC",
	title_DESC = "title_DESC",
	summary_ASC = "summary_ASC",
	summary_DESC = "summary_DESC",
	slug_ASC = "slug_ASC",
	slug_DESC = "slug_DESC",
	pageNumber_ASC = "pageNumber_ASC",
	pageNumber_DESC = "pageNumber_DESC"
}
export const enum ProjectOrderByInput {
	publishedAt_ASC = "publishedAt_ASC",
	publishedAt_DESC = "publishedAt_DESC",
	updatedAt_ASC = "updatedAt_ASC",
	updatedAt_DESC = "updatedAt_DESC",
	createdAt_ASC = "createdAt_ASC",
	createdAt_DESC = "createdAt_DESC",
	id_ASC = "id_ASC",
	id_DESC = "id_DESC",
	name_ASC = "name_ASC",
	name_DESC = "name_DESC",
	slug_ASC = "slug_ASC",
	slug_DESC = "slug_DESC",
	description_ASC = "description_ASC",
	description_DESC = "description_DESC",
	tags_ASC = "tags_ASC",
	tags_DESC = "tags_DESC",
	demo_ASC = "demo_ASC",
	demo_DESC = "demo_DESC",
	sourceCode_ASC = "sourceCode_ASC",
	sourceCode_DESC = "sourceCode_DESC"
}
export const enum ScheduledOperationOrderByInput {
	errorMessage_ASC = "errorMessage_ASC",
	errorMessage_DESC = "errorMessage_DESC",
	description_ASC = "description_ASC",
	description_DESC = "description_DESC",
	publishedAt_ASC = "publishedAt_ASC",
	publishedAt_DESC = "publishedAt_DESC",
	updatedAt_ASC = "updatedAt_ASC",
	updatedAt_DESC = "updatedAt_DESC",
	createdAt_ASC = "createdAt_ASC",
	createdAt_DESC = "createdAt_DESC",
	id_ASC = "id_ASC",
	id_DESC = "id_DESC",
	status_ASC = "status_ASC",
	status_DESC = "status_DESC"
}
/** System Scheduled Operation Status */
export const enum ScheduledOperationStatus {
	CANCELED = "CANCELED",
	COMPLETED = "COMPLETED",
	FAILED = "FAILED",
	IN_PROGRESS = "IN_PROGRESS",
	PENDING = "PENDING"
}
export const enum ScheduledReleaseOrderByInput {
	releaseAt_ASC = "releaseAt_ASC",
	releaseAt_DESC = "releaseAt_DESC",
	isImplicit_ASC = "isImplicit_ASC",
	isImplicit_DESC = "isImplicit_DESC",
	isActive_ASC = "isActive_ASC",
	isActive_DESC = "isActive_DESC",
	errorMessage_ASC = "errorMessage_ASC",
	errorMessage_DESC = "errorMessage_DESC",
	description_ASC = "description_ASC",
	description_DESC = "description_DESC",
	title_ASC = "title_ASC",
	title_DESC = "title_DESC",
	publishedAt_ASC = "publishedAt_ASC",
	publishedAt_DESC = "publishedAt_DESC",
	updatedAt_ASC = "updatedAt_ASC",
	updatedAt_DESC = "updatedAt_DESC",
	createdAt_ASC = "createdAt_ASC",
	createdAt_DESC = "createdAt_DESC",
	id_ASC = "id_ASC",
	id_DESC = "id_DESC",
	status_ASC = "status_ASC",
	status_DESC = "status_DESC"
}
/** System Scheduled Release Status */
export const enum ScheduledReleaseStatus {
	COMPLETED = "COMPLETED",
	FAILED = "FAILED",
	IN_PROGRESS = "IN_PROGRESS",
	PENDING = "PENDING"
}
export const enum SkillOrderByInput {
	publishedAt_ASC = "publishedAt_ASC",
	publishedAt_DESC = "publishedAt_DESC",
	updatedAt_ASC = "updatedAt_ASC",
	updatedAt_DESC = "updatedAt_DESC",
	createdAt_ASC = "createdAt_ASC",
	createdAt_DESC = "createdAt_DESC",
	id_ASC = "id_ASC",
	id_DESC = "id_DESC",
	name_ASC = "name_ASC",
	name_DESC = "name_DESC"
}
export const enum SocialOrderByInput {
	publishedAt_ASC = "publishedAt_ASC",
	publishedAt_DESC = "publishedAt_DESC",
	updatedAt_ASC = "updatedAt_ASC",
	updatedAt_DESC = "updatedAt_DESC",
	createdAt_ASC = "createdAt_ASC",
	createdAt_DESC = "createdAt_DESC",
	id_ASC = "id_ASC",
	id_DESC = "id_DESC",
	name_ASC = "name_ASC",
	name_DESC = "name_DESC",
	url_ASC = "url_ASC",
	url_DESC = "url_DESC"
}
/** Stage system enumeration */
export const enum Stage {
	DRAFT = "DRAFT",
	PUBLISHED = "PUBLISHED"
}
export const enum SystemDateTimeFieldVariation {
	BASE = "BASE",
	LOCALIZATION = "LOCALIZATION",
	COMBINED = "COMBINED"
}
/** System User Kind */
export const enum UserKind {
	MEMBER = "MEMBER",
	PAT = "PAT",
	PUBLIC = "PUBLIC",
	WEBHOOK = "WEBHOOK"
}
export const enum UserOrderByInput {
	isActive_ASC = "isActive_ASC",
	isActive_DESC = "isActive_DESC",
	picture_ASC = "picture_ASC",
	picture_DESC = "picture_DESC",
	name_ASC = "name_ASC",
	name_DESC = "name_DESC",
	publishedAt_ASC = "publishedAt_ASC",
	publishedAt_DESC = "publishedAt_DESC",
	updatedAt_ASC = "updatedAt_ASC",
	updatedAt_DESC = "updatedAt_DESC",
	createdAt_ASC = "createdAt_ASC",
	createdAt_DESC = "createdAt_DESC",
	id_ASC = "id_ASC",
	id_DESC = "id_DESC",
	kind_ASC = "kind_ASC",
	kind_DESC = "kind_DESC"
}
export const enum _FilterKind {
	search = "search",
	AND = "AND",
	OR = "OR",
	NOT = "NOT",
	eq = "eq",
	eq_not = "eq_not",
	in = "in",
	not_in = "not_in",
	lt = "lt",
	lte = "lte",
	gt = "gt",
	gte = "gte",
	contains = "contains",
	not_contains = "not_contains",
	starts_with = "starts_with",
	not_starts_with = "not_starts_with",
	ends_with = "ends_with",
	not_ends_with = "not_ends_with",
	contains_all = "contains_all",
	contains_some = "contains_some",
	contains_none = "contains_none",
	relational_single = "relational_single",
	relational_every = "relational_every",
	relational_some = "relational_some",
	relational_none = "relational_none"
}
export const enum _MutationInputFieldKind {
	scalar = "scalar",
	richText = "richText",
	richTextWithEmbeds = "richTextWithEmbeds",
	enum = "enum",
	relation = "relation",
	union = "union",
	virtual = "virtual"
}
export const enum _MutationKind {
	create = "create",
	publish = "publish",
	unpublish = "unpublish",
	update = "update",
	upsert = "upsert",
	delete = "delete",
	updateMany = "updateMany",
	publishMany = "publishMany",
	unpublishMany = "unpublishMany",
	deleteMany = "deleteMany",
	schedulePublish = "schedulePublish",
	scheduleUnpublish = "scheduleUnpublish"
}
export const enum _OrderDirection {
	asc = "asc",
	desc = "desc"
}
export const enum _RelationInputCardinality {
	one = "one",
	many = "many"
}
export const enum _RelationInputKind {
	create = "create",
	update = "update"
}
export const enum _RelationKind {
	regular = "regular",
	union = "union"
}
export const enum _SystemDateTimeFieldVariation {
	base = "base",
	localization = "localization",
	combined = "combined"
}

type ZEUS_VARIABLES = {
	["AssetConnectInput"]: ValueTypes["AssetConnectInput"];
	["AssetCreateInput"]: ValueTypes["AssetCreateInput"];
	["AssetCreateLocalizationDataInput"]: ValueTypes["AssetCreateLocalizationDataInput"];
	["AssetCreateLocalizationInput"]: ValueTypes["AssetCreateLocalizationInput"];
	["AssetCreateLocalizationsInput"]: ValueTypes["AssetCreateLocalizationsInput"];
	["AssetCreateManyInlineInput"]: ValueTypes["AssetCreateManyInlineInput"];
	["AssetCreateOneInlineInput"]: ValueTypes["AssetCreateOneInlineInput"];
	["AssetManyWhereInput"]: ValueTypes["AssetManyWhereInput"];
	["AssetOrderByInput"]: ValueTypes["AssetOrderByInput"];
	["AssetTransformationInput"]: ValueTypes["AssetTransformationInput"];
	["AssetUpdateInput"]: ValueTypes["AssetUpdateInput"];
	["AssetUpdateLocalizationDataInput"]: ValueTypes["AssetUpdateLocalizationDataInput"];
	["AssetUpdateLocalizationInput"]: ValueTypes["AssetUpdateLocalizationInput"];
	["AssetUpdateLocalizationsInput"]: ValueTypes["AssetUpdateLocalizationsInput"];
	["AssetUpdateManyInlineInput"]: ValueTypes["AssetUpdateManyInlineInput"];
	["AssetUpdateManyInput"]: ValueTypes["AssetUpdateManyInput"];
	["AssetUpdateManyLocalizationDataInput"]: ValueTypes["AssetUpdateManyLocalizationDataInput"];
	["AssetUpdateManyLocalizationInput"]: ValueTypes["AssetUpdateManyLocalizationInput"];
	["AssetUpdateManyLocalizationsInput"]: ValueTypes["AssetUpdateManyLocalizationsInput"];
	["AssetUpdateManyWithNestedWhereInput"]: ValueTypes["AssetUpdateManyWithNestedWhereInput"];
	["AssetUpdateOneInlineInput"]: ValueTypes["AssetUpdateOneInlineInput"];
	["AssetUpdateWithNestedWhereUniqueInput"]: ValueTypes["AssetUpdateWithNestedWhereUniqueInput"];
	["AssetUpsertInput"]: ValueTypes["AssetUpsertInput"];
	["AssetUpsertLocalizationInput"]: ValueTypes["AssetUpsertLocalizationInput"];
	["AssetUpsertWithNestedWhereUniqueInput"]: ValueTypes["AssetUpsertWithNestedWhereUniqueInput"];
	["AssetWhereInput"]: ValueTypes["AssetWhereInput"];
	["AssetWhereUniqueInput"]: ValueTypes["AssetWhereUniqueInput"];
	["ColorInput"]: ValueTypes["ColorInput"];
	["ConnectPositionInput"]: ValueTypes["ConnectPositionInput"];
	["Date"]: ValueTypes["Date"];
	["DateTime"]: ValueTypes["DateTime"];
	["DocumentFileTypes"]: ValueTypes["DocumentFileTypes"];
	["DocumentOutputInput"]: ValueTypes["DocumentOutputInput"];
	["DocumentTransformationInput"]: ValueTypes["DocumentTransformationInput"];
	["Hex"]: ValueTypes["Hex"];
	["ImageFit"]: ValueTypes["ImageFit"];
	["ImageResizeInput"]: ValueTypes["ImageResizeInput"];
	["ImageTransformationInput"]: ValueTypes["ImageTransformationInput"];
	["Json"]: ValueTypes["Json"];
	["Locale"]: ValueTypes["Locale"];
	["LocationInput"]: ValueTypes["LocationInput"];
	["Long"]: ValueTypes["Long"];
	["PageMetadataConnectInput"]: ValueTypes["PageMetadataConnectInput"];
	["PageMetadataCreateInput"]: ValueTypes["PageMetadataCreateInput"];
	["PageMetadataCreateManyInlineInput"]: ValueTypes["PageMetadataCreateManyInlineInput"];
	["PageMetadataCreateOneInlineInput"]: ValueTypes["PageMetadataCreateOneInlineInput"];
	["PageMetadataManyWhereInput"]: ValueTypes["PageMetadataManyWhereInput"];
	["PageMetadataOrderByInput"]: ValueTypes["PageMetadataOrderByInput"];
	["PageMetadataUpdateInput"]: ValueTypes["PageMetadataUpdateInput"];
	["PageMetadataUpdateManyInlineInput"]: ValueTypes["PageMetadataUpdateManyInlineInput"];
	["PageMetadataUpdateManyInput"]: ValueTypes["PageMetadataUpdateManyInput"];
	["PageMetadataUpdateManyWithNestedWhereInput"]: ValueTypes["PageMetadataUpdateManyWithNestedWhereInput"];
	["PageMetadataUpdateOneInlineInput"]: ValueTypes["PageMetadataUpdateOneInlineInput"];
	["PageMetadataUpdateWithNestedWhereUniqueInput"]: ValueTypes["PageMetadataUpdateWithNestedWhereUniqueInput"];
	["PageMetadataUpsertInput"]: ValueTypes["PageMetadataUpsertInput"];
	["PageMetadataUpsertWithNestedWhereUniqueInput"]: ValueTypes["PageMetadataUpsertWithNestedWhereUniqueInput"];
	["PageMetadataWhereInput"]: ValueTypes["PageMetadataWhereInput"];
	["PageMetadataWhereUniqueInput"]: ValueTypes["PageMetadataWhereUniqueInput"];
	["ProjectConnectInput"]: ValueTypes["ProjectConnectInput"];
	["ProjectCreateInput"]: ValueTypes["ProjectCreateInput"];
	["ProjectCreateManyInlineInput"]: ValueTypes["ProjectCreateManyInlineInput"];
	["ProjectCreateOneInlineInput"]: ValueTypes["ProjectCreateOneInlineInput"];
	["ProjectManyWhereInput"]: ValueTypes["ProjectManyWhereInput"];
	["ProjectOrderByInput"]: ValueTypes["ProjectOrderByInput"];
	["ProjectUpdateInput"]: ValueTypes["ProjectUpdateInput"];
	["ProjectUpdateManyInlineInput"]: ValueTypes["ProjectUpdateManyInlineInput"];
	["ProjectUpdateManyInput"]: ValueTypes["ProjectUpdateManyInput"];
	["ProjectUpdateManyWithNestedWhereInput"]: ValueTypes["ProjectUpdateManyWithNestedWhereInput"];
	["ProjectUpdateOneInlineInput"]: ValueTypes["ProjectUpdateOneInlineInput"];
	["ProjectUpdateWithNestedWhereUniqueInput"]: ValueTypes["ProjectUpdateWithNestedWhereUniqueInput"];
	["ProjectUpsertInput"]: ValueTypes["ProjectUpsertInput"];
	["ProjectUpsertWithNestedWhereUniqueInput"]: ValueTypes["ProjectUpsertWithNestedWhereUniqueInput"];
	["ProjectWhereInput"]: ValueTypes["ProjectWhereInput"];
	["ProjectWhereUniqueInput"]: ValueTypes["ProjectWhereUniqueInput"];
	["PublishLocaleInput"]: ValueTypes["PublishLocaleInput"];
	["RGBAHue"]: ValueTypes["RGBAHue"];
	["RGBAInput"]: ValueTypes["RGBAInput"];
	["RGBATransparency"]: ValueTypes["RGBATransparency"];
	["RichTextAST"]: ValueTypes["RichTextAST"];
	["ScheduledOperationConnectInput"]: ValueTypes["ScheduledOperationConnectInput"];
	["ScheduledOperationCreateManyInlineInput"]: ValueTypes["ScheduledOperationCreateManyInlineInput"];
	["ScheduledOperationCreateOneInlineInput"]: ValueTypes["ScheduledOperationCreateOneInlineInput"];
	["ScheduledOperationManyWhereInput"]: ValueTypes["ScheduledOperationManyWhereInput"];
	["ScheduledOperationOrderByInput"]: ValueTypes["ScheduledOperationOrderByInput"];
	["ScheduledOperationStatus"]: ValueTypes["ScheduledOperationStatus"];
	["ScheduledOperationUpdateManyInlineInput"]: ValueTypes["ScheduledOperationUpdateManyInlineInput"];
	["ScheduledOperationUpdateOneInlineInput"]: ValueTypes["ScheduledOperationUpdateOneInlineInput"];
	["ScheduledOperationWhereInput"]: ValueTypes["ScheduledOperationWhereInput"];
	["ScheduledOperationWhereUniqueInput"]: ValueTypes["ScheduledOperationWhereUniqueInput"];
	["ScheduledReleaseConnectInput"]: ValueTypes["ScheduledReleaseConnectInput"];
	["ScheduledReleaseCreateInput"]: ValueTypes["ScheduledReleaseCreateInput"];
	["ScheduledReleaseCreateManyInlineInput"]: ValueTypes["ScheduledReleaseCreateManyInlineInput"];
	["ScheduledReleaseCreateOneInlineInput"]: ValueTypes["ScheduledReleaseCreateOneInlineInput"];
	["ScheduledReleaseManyWhereInput"]: ValueTypes["ScheduledReleaseManyWhereInput"];
	["ScheduledReleaseOrderByInput"]: ValueTypes["ScheduledReleaseOrderByInput"];
	["ScheduledReleaseStatus"]: ValueTypes["ScheduledReleaseStatus"];
	["ScheduledReleaseUpdateInput"]: ValueTypes["ScheduledReleaseUpdateInput"];
	["ScheduledReleaseUpdateManyInlineInput"]: ValueTypes["ScheduledReleaseUpdateManyInlineInput"];
	["ScheduledReleaseUpdateManyInput"]: ValueTypes["ScheduledReleaseUpdateManyInput"];
	["ScheduledReleaseUpdateManyWithNestedWhereInput"]: ValueTypes["ScheduledReleaseUpdateManyWithNestedWhereInput"];
	["ScheduledReleaseUpdateOneInlineInput"]: ValueTypes["ScheduledReleaseUpdateOneInlineInput"];
	["ScheduledReleaseUpdateWithNestedWhereUniqueInput"]: ValueTypes["ScheduledReleaseUpdateWithNestedWhereUniqueInput"];
	["ScheduledReleaseUpsertInput"]: ValueTypes["ScheduledReleaseUpsertInput"];
	["ScheduledReleaseUpsertWithNestedWhereUniqueInput"]: ValueTypes["ScheduledReleaseUpsertWithNestedWhereUniqueInput"];
	["ScheduledReleaseWhereInput"]: ValueTypes["ScheduledReleaseWhereInput"];
	["ScheduledReleaseWhereUniqueInput"]: ValueTypes["ScheduledReleaseWhereUniqueInput"];
	["SkillConnectInput"]: ValueTypes["SkillConnectInput"];
	["SkillCreateInput"]: ValueTypes["SkillCreateInput"];
	["SkillCreateManyInlineInput"]: ValueTypes["SkillCreateManyInlineInput"];
	["SkillCreateOneInlineInput"]: ValueTypes["SkillCreateOneInlineInput"];
	["SkillManyWhereInput"]: ValueTypes["SkillManyWhereInput"];
	["SkillOrderByInput"]: ValueTypes["SkillOrderByInput"];
	["SkillUpdateInput"]: ValueTypes["SkillUpdateInput"];
	["SkillUpdateManyInlineInput"]: ValueTypes["SkillUpdateManyInlineInput"];
	["SkillUpdateManyInput"]: ValueTypes["SkillUpdateManyInput"];
	["SkillUpdateManyWithNestedWhereInput"]: ValueTypes["SkillUpdateManyWithNestedWhereInput"];
	["SkillUpdateOneInlineInput"]: ValueTypes["SkillUpdateOneInlineInput"];
	["SkillUpdateWithNestedWhereUniqueInput"]: ValueTypes["SkillUpdateWithNestedWhereUniqueInput"];
	["SkillUpsertInput"]: ValueTypes["SkillUpsertInput"];
	["SkillUpsertWithNestedWhereUniqueInput"]: ValueTypes["SkillUpsertWithNestedWhereUniqueInput"];
	["SkillWhereInput"]: ValueTypes["SkillWhereInput"];
	["SkillWhereUniqueInput"]: ValueTypes["SkillWhereUniqueInput"];
	["SocialConnectInput"]: ValueTypes["SocialConnectInput"];
	["SocialCreateInput"]: ValueTypes["SocialCreateInput"];
	["SocialCreateManyInlineInput"]: ValueTypes["SocialCreateManyInlineInput"];
	["SocialCreateOneInlineInput"]: ValueTypes["SocialCreateOneInlineInput"];
	["SocialManyWhereInput"]: ValueTypes["SocialManyWhereInput"];
	["SocialOrderByInput"]: ValueTypes["SocialOrderByInput"];
	["SocialUpdateInput"]: ValueTypes["SocialUpdateInput"];
	["SocialUpdateManyInlineInput"]: ValueTypes["SocialUpdateManyInlineInput"];
	["SocialUpdateManyInput"]: ValueTypes["SocialUpdateManyInput"];
	["SocialUpdateManyWithNestedWhereInput"]: ValueTypes["SocialUpdateManyWithNestedWhereInput"];
	["SocialUpdateOneInlineInput"]: ValueTypes["SocialUpdateOneInlineInput"];
	["SocialUpdateWithNestedWhereUniqueInput"]: ValueTypes["SocialUpdateWithNestedWhereUniqueInput"];
	["SocialUpsertInput"]: ValueTypes["SocialUpsertInput"];
	["SocialUpsertWithNestedWhereUniqueInput"]: ValueTypes["SocialUpsertWithNestedWhereUniqueInput"];
	["SocialWhereInput"]: ValueTypes["SocialWhereInput"];
	["SocialWhereUniqueInput"]: ValueTypes["SocialWhereUniqueInput"];
	["Stage"]: ValueTypes["Stage"];
	["SystemDateTimeFieldVariation"]: ValueTypes["SystemDateTimeFieldVariation"];
	["UnpublishLocaleInput"]: ValueTypes["UnpublishLocaleInput"];
	["UserConnectInput"]: ValueTypes["UserConnectInput"];
	["UserCreateManyInlineInput"]: ValueTypes["UserCreateManyInlineInput"];
	["UserCreateOneInlineInput"]: ValueTypes["UserCreateOneInlineInput"];
	["UserKind"]: ValueTypes["UserKind"];
	["UserManyWhereInput"]: ValueTypes["UserManyWhereInput"];
	["UserOrderByInput"]: ValueTypes["UserOrderByInput"];
	["UserUpdateManyInlineInput"]: ValueTypes["UserUpdateManyInlineInput"];
	["UserUpdateOneInlineInput"]: ValueTypes["UserUpdateOneInlineInput"];
	["UserWhereInput"]: ValueTypes["UserWhereInput"];
	["UserWhereUniqueInput"]: ValueTypes["UserWhereUniqueInput"];
	["VersionWhereInput"]: ValueTypes["VersionWhereInput"];
	["_FilterKind"]: ValueTypes["_FilterKind"];
	["_MutationInputFieldKind"]: ValueTypes["_MutationInputFieldKind"];
	["_MutationKind"]: ValueTypes["_MutationKind"];
	["_OrderDirection"]: ValueTypes["_OrderDirection"];
	["_RelationInputCardinality"]: ValueTypes["_RelationInputCardinality"];
	["_RelationInputKind"]: ValueTypes["_RelationInputKind"];
	["_RelationKind"]: ValueTypes["_RelationKind"];
	["_SystemDateTimeFieldVariation"]: ValueTypes["_SystemDateTimeFieldVariation"];
}