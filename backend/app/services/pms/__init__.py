"""PMS interface processing (CA-119): a Data Bank day → a JV, parked for review or posted.

`day` is the arithmetic (pure), `mapping` the per-BU code → account rules and the AI's
suggestions, `posting` the one place that talks to Carmen's JV endpoint, `process` the job
the webhook and the sweep run, `review` the person's half (approve/reject).
"""
