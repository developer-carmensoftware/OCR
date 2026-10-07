/**
 * The admin dashboard's copy, one file per page (`admin.email.*` lives in `./email.ts`).
 * Not part of the customer DICT: `registerDict(adminDict)` merges it in when the admin chunk
 * loads, so none of this ships in the customer bundle. See `i18n/dict/index.ts`.
 */

import * as chrome from './chrome'
import * as nav from './nav'
import * as maintenance from './maintenance'
import * as common from './common'
import * as overview from './overview'
import * as login from './login'
import * as anomalies from './anomalies'
import * as sessions from './sessions'
import * as jobs from './jobs'
import * as email from './email'
import * as performance from './performance'
import * as usage from './usage'
import * as llmLogs from './llmLogs'
import * as extractions from './extractions'
import * as errors from './errors'
import * as credits from './credits'
import * as tenantRanking from './tenantRanking'
import * as userUsage from './userUsage'
import * as tenants from './tenants'
import * as quotas from './quotas'
import * as adminUsers from './adminUsers'
import * as apiKeys from './apiKeys'

export const adminDict = {
  en: {
    ...chrome.en,
    ...nav.en,
    ...maintenance.en,
    ...common.en,
    ...overview.en,
    ...login.en,
    ...anomalies.en,
    ...sessions.en,
    ...jobs.en,
    ...email.en,
    ...performance.en,
    ...usage.en,
    ...llmLogs.en,
    ...extractions.en,
    ...errors.en,
    ...credits.en,
    ...tenantRanking.en,
    ...userUsage.en,
    ...tenants.en,
    ...quotas.en,
    ...adminUsers.en,
    ...apiKeys.en,
  },
  th: {
    ...chrome.th,
    ...nav.th,
    ...maintenance.th,
    ...common.th,
    ...overview.th,
    ...login.th,
    ...anomalies.th,
    ...sessions.th,
    ...jobs.th,
    ...email.th,
    ...performance.th,
    ...usage.th,
    ...llmLogs.th,
    ...extractions.th,
    ...errors.th,
    ...credits.th,
    ...tenantRanking.th,
    ...userUsage.th,
    ...tenants.th,
    ...quotas.th,
    ...adminUsers.th,
    ...apiKeys.th,
  },
}

export type AdminKey = keyof typeof adminDict.en
