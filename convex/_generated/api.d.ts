/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as demo_demo from "../demo/demo.js";
import type * as leads_actions from "../leads/actions.js";
import type * as leads_mutations from "../leads/mutations.js";
import type * as leads_queries from "../leads/queries.js";
import type * as twilio_twilio from "../twilio/twilio.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "demo/demo": typeof demo_demo;
  "leads/actions": typeof leads_actions;
  "leads/mutations": typeof leads_mutations;
  "leads/queries": typeof leads_queries;
  "twilio/twilio": typeof twilio_twilio;
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

export declare const components: {};
