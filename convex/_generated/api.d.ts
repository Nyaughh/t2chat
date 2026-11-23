/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as api_keys from "../api_keys.js";
import type * as appearance from "../appearance.js";
import type * as appearanceValidator from "../appearanceValidator.js";
import type * as auth from "../auth.js";
import type * as chat_access from "../chat/access.js";
import type * as chat_actions from "../chat/actions.js";
import type * as chat_mutations from "../chat/mutations.js";
import type * as chat_node from "../chat/node.js";
import type * as chat_queries from "../chat/queries.js";
import type * as chat_shared from "../chat/shared.js";
import type * as chat_streaming from "../chat/streaming.js";
import type * as http from "../http.js";
import type * as tts from "../tts.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  api_keys: typeof api_keys;
  appearance: typeof appearance;
  appearanceValidator: typeof appearanceValidator;
  auth: typeof auth;
  "chat/access": typeof chat_access;
  "chat/actions": typeof chat_actions;
  "chat/mutations": typeof chat_mutations;
  "chat/node": typeof chat_node;
  "chat/queries": typeof chat_queries;
  "chat/shared": typeof chat_shared;
  "chat/streaming": typeof chat_streaming;
  http: typeof http;
  tts: typeof tts;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
