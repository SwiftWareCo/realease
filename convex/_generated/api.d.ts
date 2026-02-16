/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as demo_demo from "../demo/demo.js";
import type * as devtools_mockData from "../devtools/mockData.js";
import type * as devtools_mockDataMutations from "../devtools/mockDataMutations.js";
import type * as events_mutations from "../events/mutations.js";
import type * as events_queries from "../events/queries.js";
import type * as http from "../http.js";
import type * as insights_actions from "../insights/actions.js";
import type * as insights_mutations from "../insights/mutations.js";
import type * as insights_queries from "../insights/queries.js";
import type * as insights_sources from "../insights/sources.js";
import type * as leads_actions from "../leads/actions.js";
import type * as leads_mutations from "../leads/mutations.js";
import type * as leads_queries from "../leads/queries.js";
import type * as openrouter from "../openrouter.js";
import type * as outreach_actions from "../outreach/actions.js";
import type * as outreach_mutations from "../outreach/mutations.js";
import type * as outreach_phone from "../outreach/phone.js";
import type * as outreach_queries from "../outreach/queries.js";
import type * as twilio_twilio from "../twilio/twilio.js";
import type * as users from "../users.js";
import type * as users_mutations from "../users/mutations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "demo/demo": typeof demo_demo;
  "devtools/mockData": typeof devtools_mockData;
  "devtools/mockDataMutations": typeof devtools_mockDataMutations;
  "events/mutations": typeof events_mutations;
  "events/queries": typeof events_queries;
  http: typeof http;
  "insights/actions": typeof insights_actions;
  "insights/mutations": typeof insights_mutations;
  "insights/queries": typeof insights_queries;
  "insights/sources": typeof insights_sources;
  "leads/actions": typeof leads_actions;
  "leads/mutations": typeof leads_mutations;
  "leads/queries": typeof leads_queries;
  openrouter: typeof openrouter;
  "outreach/actions": typeof outreach_actions;
  "outreach/mutations": typeof outreach_mutations;
  "outreach/phone": typeof outreach_phone;
  "outreach/queries": typeof outreach_queries;
  "twilio/twilio": typeof twilio_twilio;
  users: typeof users;
  "users/mutations": typeof users_mutations;
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
