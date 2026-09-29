# Not an aggregator: app/factory.py imports ocr, activity and mapping directly, same as
# before this package existed — see app/routers/admin/__init__.py for the aggregator
# pattern used where sub-routers actually need to share one prefix.
