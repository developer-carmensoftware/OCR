"""PMS interface processing (CA-119): a Data Bank day → a JV, parked for review or posted.

`carmen_config` reads Carmen's PMS setting the way its engine does (pure), `mapping` the AI's
suggestions for rows Carmen's mapping table cannot place, `process` the job the webhook and
the sweep run (and `post_day`, which asks Carmen's engine to post), `review` the person's half
(approve/reject). Docs: docs/pms-interface/.
"""
