/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as demo_demo from "../demo/demo.js";
import type * as devtools_mockData from "../devtools/mockData.js";
import type * as devtools_mockDataMutations from "../devtools/mockDataMutations.js";
import type * as events_mutations from "../events/mutations.js";
import type * as events_queries from "../events/queries.js";
import type * as http from "../http.js";
import type * as insights_actions from "../insights/actions.js";
import type * as insights_apiFetchers from "../insights/apiFetchers.js";
import type * as insights_extractMetrics from "../insights/extractMetrics.js";
import type * as insights_gvrActivityMapping from "../insights/gvrActivityMapping.js";
import type * as insights_gvrDiscovery from "../insights/gvrDiscovery.js";
import type * as insights_gvrParser from "../insights/gvrParser.js";
import type * as insights_marketSummary from "../insights/marketSummary.js";
import type * as insights_metricHistoryMutations from "../insights/metricHistoryMutations.js";
import type * as insights_metricHistoryQueries from "../insights/metricHistoryQueries.js";
import type * as insights_metricsMutations from "../insights/metricsMutations.js";
import type * as insights_metricsQueries from "../insights/metricsQueries.js";
import type * as insights_mutations from "../insights/mutations.js";
import type * as insights_newsSources from "../insights/newsSources.js";
import type * as insights_openrouterUtils from "../insights/openrouterUtils.js";
import type * as insights_queries from "../insights/queries.js";
import type * as insights_sources from "../insights/sources.js";
import type * as leads_actions from "../leads/actions.js";
import type * as leads_mutations from "../leads/mutations.js";
import type * as leads_queries from "../leads/queries.js";
import type * as openrouter from "../openrouter.js";
import type * as openrouterConfig from "../openrouterConfig.js";
import type * as outreach_actions from "../outreach/actions.js";
import type * as outreach_auth from "../outreach/auth.js";
import type * as outreach_callingWindow from "../outreach/callingWindow.js";
import type * as outreach_campaignLeadState from "../outreach/campaignLeadState.js";
import type * as outreach_counterBackfill from "../outreach/counterBackfill.js";
import type * as outreach_counterTriggers from "../outreach/counterTriggers.js";
import type * as outreach_counters from "../outreach/counters.js";
import type * as outreach_dataMigration from "../outreach/dataMigration.js";
import type * as outreach_eligibility from "../outreach/eligibility.js";
import type * as outreach_latestCalls from "../outreach/latestCalls.js";
import type * as outreach_mutations from "../outreach/mutations.js";
import type * as outreach_phone from "../outreach/phone.js";
import type * as outreach_queries from "../outreach/queries.js";
import type * as outreach_runtimeSummary from "../outreach/runtimeSummary.js";
import type * as outreach_templates from "../outreach/templates.js";
import type * as twilio_twilio from "../twilio/twilio.js";
import type * as users from "../users.js";
import type * as users_mutations from "../users/mutations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  "demo/demo": typeof demo_demo;
  "devtools/mockData": typeof devtools_mockData;
  "devtools/mockDataMutations": typeof devtools_mockDataMutations;
  "events/mutations": typeof events_mutations;
  "events/queries": typeof events_queries;
  http: typeof http;
  "insights/actions": typeof insights_actions;
  "insights/apiFetchers": typeof insights_apiFetchers;
  "insights/extractMetrics": typeof insights_extractMetrics;
  "insights/gvrActivityMapping": typeof insights_gvrActivityMapping;
  "insights/gvrDiscovery": typeof insights_gvrDiscovery;
  "insights/gvrParser": typeof insights_gvrParser;
  "insights/marketSummary": typeof insights_marketSummary;
  "insights/metricHistoryMutations": typeof insights_metricHistoryMutations;
  "insights/metricHistoryQueries": typeof insights_metricHistoryQueries;
  "insights/metricsMutations": typeof insights_metricsMutations;
  "insights/metricsQueries": typeof insights_metricsQueries;
  "insights/mutations": typeof insights_mutations;
  "insights/newsSources": typeof insights_newsSources;
  "insights/openrouterUtils": typeof insights_openrouterUtils;
  "insights/queries": typeof insights_queries;
  "insights/sources": typeof insights_sources;
  "leads/actions": typeof leads_actions;
  "leads/mutations": typeof leads_mutations;
  "leads/queries": typeof leads_queries;
  openrouter: typeof openrouter;
  openrouterConfig: typeof openrouterConfig;
  "outreach/actions": typeof outreach_actions;
  "outreach/auth": typeof outreach_auth;
  "outreach/callingWindow": typeof outreach_callingWindow;
  "outreach/campaignLeadState": typeof outreach_campaignLeadState;
  "outreach/counterBackfill": typeof outreach_counterBackfill;
  "outreach/counterTriggers": typeof outreach_counterTriggers;
  "outreach/counters": typeof outreach_counters;
  "outreach/dataMigration": typeof outreach_dataMigration;
  "outreach/eligibility": typeof outreach_eligibility;
  "outreach/latestCalls": typeof outreach_latestCalls;
  "outreach/mutations": typeof outreach_mutations;
  "outreach/phone": typeof outreach_phone;
  "outreach/queries": typeof outreach_queries;
  "outreach/runtimeSummary": typeof outreach_runtimeSummary;
  "outreach/templates": typeof outreach_templates;
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

export declare const components: {
  outreachStateCounts: {
    btree: {
      aggregateBetween: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any },
        { count: number; sum: number }
      >;
      aggregateBetweenBatch: FunctionReference<
        "query",
        "internal",
        { queries: Array<{ k1?: any; k2?: any; namespace?: any }> },
        Array<{ count: number; sum: number }>
      >;
      atNegativeOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffsetBatch: FunctionReference<
        "query",
        "internal",
        {
          queries: Array<{
            k1?: any;
            k2?: any;
            namespace?: any;
            offset: number;
          }>;
        },
        Array<{ k: any; s: number; v: any }>
      >;
      get: FunctionReference<
        "query",
        "internal",
        { key: any; namespace?: any },
        null | { k: any; s: number; v: any }
      >;
      offset: FunctionReference<
        "query",
        "internal",
        { k1?: any; key: any; namespace?: any },
        number
      >;
      offsetUntil: FunctionReference<
        "query",
        "internal",
        { k2?: any; key: any; namespace?: any },
        number
      >;
      paginate: FunctionReference<
        "query",
        "internal",
        {
          cursor?: string;
          k1?: any;
          k2?: any;
          limit: number;
          namespace?: any;
          order: "asc" | "desc";
        },
        {
          cursor: string;
          isDone: boolean;
          page: Array<{ k: any; s: number; v: any }>;
        }
      >;
      paginateNamespaces: FunctionReference<
        "query",
        "internal",
        { cursor?: string; limit: number },
        { cursor: string; isDone: boolean; page: Array<any> }
      >;
      validate: FunctionReference<
        "query",
        "internal",
        { namespace?: any },
        any
      >;
    };
    inspect: {
      display: FunctionReference<"query", "internal", { namespace?: any }, any>;
      dump: FunctionReference<"query", "internal", { namespace?: any }, string>;
      inspectNode: FunctionReference<
        "query",
        "internal",
        { namespace?: any; node?: string },
        null
      >;
      listTreeNodes: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          aggregate?: { count: number; sum: number };
          items: Array<{ k: any; s: number; v: any }>;
          subtrees: Array<string>;
        }>
      >;
      listTrees: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          maxNodeSize: number;
          namespace?: any;
          root: string;
        }>
      >;
    };
    public: {
      clear: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      delete_: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        null
      >;
      deleteIfExists: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        any
      >;
      init: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      insert: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any; summand?: number; value: any },
        null
      >;
      makeRootLazy: FunctionReference<
        "mutation",
        "internal",
        { namespace?: any },
        null
      >;
      replace: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        null
      >;
      replaceOrInsert: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        any
      >;
    };
  };
  outreachCallOutcomeCounts: {
    btree: {
      aggregateBetween: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any },
        { count: number; sum: number }
      >;
      aggregateBetweenBatch: FunctionReference<
        "query",
        "internal",
        { queries: Array<{ k1?: any; k2?: any; namespace?: any }> },
        Array<{ count: number; sum: number }>
      >;
      atNegativeOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffset: FunctionReference<
        "query",
        "internal",
        { k1?: any; k2?: any; namespace?: any; offset: number },
        { k: any; s: number; v: any }
      >;
      atOffsetBatch: FunctionReference<
        "query",
        "internal",
        {
          queries: Array<{
            k1?: any;
            k2?: any;
            namespace?: any;
            offset: number;
          }>;
        },
        Array<{ k: any; s: number; v: any }>
      >;
      get: FunctionReference<
        "query",
        "internal",
        { key: any; namespace?: any },
        null | { k: any; s: number; v: any }
      >;
      offset: FunctionReference<
        "query",
        "internal",
        { k1?: any; key: any; namespace?: any },
        number
      >;
      offsetUntil: FunctionReference<
        "query",
        "internal",
        { k2?: any; key: any; namespace?: any },
        number
      >;
      paginate: FunctionReference<
        "query",
        "internal",
        {
          cursor?: string;
          k1?: any;
          k2?: any;
          limit: number;
          namespace?: any;
          order: "asc" | "desc";
        },
        {
          cursor: string;
          isDone: boolean;
          page: Array<{ k: any; s: number; v: any }>;
        }
      >;
      paginateNamespaces: FunctionReference<
        "query",
        "internal",
        { cursor?: string; limit: number },
        { cursor: string; isDone: boolean; page: Array<any> }
      >;
      validate: FunctionReference<
        "query",
        "internal",
        { namespace?: any },
        any
      >;
    };
    inspect: {
      display: FunctionReference<"query", "internal", { namespace?: any }, any>;
      dump: FunctionReference<"query", "internal", { namespace?: any }, string>;
      inspectNode: FunctionReference<
        "query",
        "internal",
        { namespace?: any; node?: string },
        null
      >;
      listTreeNodes: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          aggregate?: { count: number; sum: number };
          items: Array<{ k: any; s: number; v: any }>;
          subtrees: Array<string>;
        }>
      >;
      listTrees: FunctionReference<
        "query",
        "internal",
        { take?: number },
        Array<{
          _creationTime: number;
          _id: string;
          maxNodeSize: number;
          namespace?: any;
          root: string;
        }>
      >;
    };
    public: {
      clear: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      delete_: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        null
      >;
      deleteIfExists: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any },
        any
      >;
      init: FunctionReference<
        "mutation",
        "internal",
        { maxNodeSize?: number; namespace?: any; rootLazy?: boolean },
        null
      >;
      insert: FunctionReference<
        "mutation",
        "internal",
        { key: any; namespace?: any; summand?: number; value: any },
        null
      >;
      makeRootLazy: FunctionReference<
        "mutation",
        "internal",
        { namespace?: any },
        null
      >;
      replace: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        null
      >;
      replaceOrInsert: FunctionReference<
        "mutation",
        "internal",
        {
          currentKey: any;
          namespace?: any;
          newKey: any;
          newNamespace?: any;
          summand?: number;
          value: any;
        },
        any
      >;
    };
  };
};
