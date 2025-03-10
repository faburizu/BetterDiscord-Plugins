import * as Finder from "../finder";

/** A timestamped ID stored as a string. */
export type Snowflake = string;

export type ActionModule = Record<string, (...args: any) => any>;

export const Constants: any = /* @__PURE__ */ Finder.byProps(["Permissions", "RelationshipTypes"]);

export const i18n: any = /* @__PURE__ */ Finder.byProps(["languages", "getLocale"]);
