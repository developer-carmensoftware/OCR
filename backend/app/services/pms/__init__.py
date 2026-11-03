"""PMS interface processing (CA-119): a Data Bank day → a JV, parked for review or posted.

`carmen_config` derives what Carmen's PMS setting says from what the menu token can read (pure), `mapping` the AI's
suggestions for rows Carmen's mapping table cannot place, `process` the job the webhook and
the sweep run (and `post_day`, which asks Carmen's engine to post), `review` the person's half
(approve/reject). Docs: docs/pms-interface/.
"""
