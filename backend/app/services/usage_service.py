"""
Backward-compat re-export shim — Phase 10 will remove this file.

Import directly from the focused modules instead:
  pricing_cache_service  — _get_pricing, _estimate_cost, fetch_openrouter_pricing, list_model_pricing
  quota_service          — check_quota, consume_quota, increment_quota, upsert_tenant_quota, get_quota_summary
  llm_usage_logger       — log_llm_usage
"""

from app.services.llm_usage_logger import log_llm_usage as log_llm_usage
from app.services.pricing_cache_service import (
    _PRICING_CACHE as _PRICING_CACHE,
    _estimate_cost as _estimate_cost,
    _get_pricing as _get_pricing,
    _utcnow as _utcnow,
    fetch_openrouter_pricing as fetch_openrouter_pricing,
    list_model_pricing as list_model_pricing,
)
from app.services.quota_service import (
    _CachedQuota as _CachedQuota,
    _QUOTA_RULES_CACHE as _QUOTA_RULES_CACHE,
    _ctx as _ctx,
    _evaluate_quotas as _evaluate_quotas,
    _get_active_quotas as _get_active_quotas,
    _get_cached_quota_rules as _get_cached_quota_rules,
    _period_key as _period_key,
    check_quota as check_quota,
    consume_quota as consume_quota,
    get_quota_summary as get_quota_summary,
    increment_quota as increment_quota,
    upsert_tenant_quota as upsert_tenant_quota,
)
