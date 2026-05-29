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
)
from app.services.pricing_cache_service import (
    _estimate_cost as _estimate_cost,
)
from app.services.pricing_cache_service import (
    _get_pricing as _get_pricing,
)
from app.services.pricing_cache_service import (
    _utcnow as _utcnow,
)
from app.services.pricing_cache_service import (
    fetch_openrouter_pricing as fetch_openrouter_pricing,
)
from app.services.pricing_cache_service import (
    list_model_pricing as list_model_pricing,
)
from app.services.quota_service import (
    _QUOTA_RULES_CACHE as _QUOTA_RULES_CACHE,
)
from app.services.quota_service import (
    _CachedQuota as _CachedQuota,
)
from app.services.quota_service import (
    _ctx as _ctx,
)
from app.services.quota_service import (
    _evaluate_quotas as _evaluate_quotas,
)
from app.services.quota_service import (
    _get_active_quotas as _get_active_quotas,
)
from app.services.quota_service import (
    _get_cached_quota_rules as _get_cached_quota_rules,
)
from app.services.quota_service import (
    _period_key as _period_key,
)
from app.services.quota_service import (
    check_quota as check_quota,
)
from app.services.quota_service import (
    consume_quota as consume_quota,
)
from app.services.quota_service import (
    get_quota_summary as get_quota_summary,
)
from app.services.quota_service import (
    increment_quota as increment_quota,
)
from app.services.quota_service import (
    upsert_tenant_quota as upsert_tenant_quota,
)
