"""Unit tests for launch_rule service with mocked Firestore."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from backend.src.services.launch_rule import (
    is_portal_active,
    on_record_published,
    on_record_unpublished,
)

_GET_RULE = "backend.src.services.launch_rule.get_launch_rule"
_INC = "backend.src.services.launch_rule.increment_published_count"


def _rule(published_count: int, threshold: int = 10) -> dict:
    return {
        "published_count": published_count,
        "threshold": threshold,
        "portal_active": published_count >= threshold,
    }


@pytest.mark.asyncio
async def test_is_portal_active_false_when_zero():
    with patch(_GET_RULE, return_value=_rule(0)):
        result = await is_portal_active()
    assert result is False


@pytest.mark.asyncio
async def test_is_portal_active_true_at_threshold():
    with patch(_GET_RULE, return_value=_rule(10)):
        result = await is_portal_active()
    assert result is True


@pytest.mark.asyncio
async def test_on_record_published_increments_count():
    mock_inc = MagicMock(return_value=1)
    with (
        patch(_INC, mock_inc),
        patch(_GET_RULE, return_value=_rule(1)),
    ):
        result = await on_record_published()
    mock_inc.assert_called_once_with(1)
    assert result["published_count"] == 1


@pytest.mark.asyncio
async def test_on_record_unpublished_decrements_count():
    mock_inc = MagicMock(return_value=9)
    # Before: 10 (active), after: 9 (inactive)
    rule_before = _rule(10)
    rule_after = _rule(9)
    with (
        patch(_GET_RULE, side_effect=[rule_before, rule_after]),
        patch(_INC, mock_inc),
    ):
        result = await on_record_unpublished()
    mock_inc.assert_called_once_with(-1)
    assert result["published_count"] == 9


@pytest.mark.asyncio
async def test_on_record_unpublished_warns_when_portal_deactivates(capsys):
    mock_inc = MagicMock(return_value=9)
    rule_before = _rule(10)   # portal_active = True
    rule_after = _rule(9)    # portal_active = False
    with (
        patch(_GET_RULE, side_effect=[rule_before, rule_after]),
        patch(_INC, mock_inc),
    ):
        await on_record_unpublished()
    captured = capsys.readouterr()
    assert "WARNING" in captured.out or "desactivado" in captured.out
