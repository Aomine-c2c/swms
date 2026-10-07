from decimal import Decimal
from apps.system.models import SystemSetting


def check_weight_thresholds(vehicle, gross_weight=None, tare_weight=None):
    """
    Evaluates whether the given gross_weight and/or tare_weight breaches
    the Tare Tolerance or Gross Overload thresholds.
    
    Returns a list of violation dictionaries:
    [
      {
        'type': 'OVERWEIGHT_EXCEPTION' | 'TARE_TOLERANCE_EXCEPTION',
        'rule': 'Gross Overload' | 'Tare Tolerance Exceeded',
        'actual': Decimal,
        'limit': Decimal,
        'delta': Decimal,
        'delta_pct': Decimal (optional),
        'message': str
      }
    ]
    """
    violations = []
    settings = SystemSetting.get_settings()

    # 1. Gross Overload Check
    if gross_weight is not None and settings.overweight_enforcement_enabled and vehicle and vehicle.max_capacity:
        gross_val = Decimal(str(gross_weight))
        max_cap = Decimal(str(vehicle.max_capacity))
        if gross_val > max_cap:
            overload_kg = gross_val - max_cap
            overload_pct = round((overload_kg / max_cap) * Decimal('100'), 2)
            violations.append({
                'type': 'OVERWEIGHT_EXCEPTION',
                'rule': 'Gross Overload',
                'actual': float(gross_val),
                'limit': float(max_cap),
                'delta': float(overload_kg),
                'delta_pct': float(overload_pct),
                'message': f"Gross weight ({gross_val:.2f} kg) exceeds vehicle max capacity ({max_cap:.2f} kg) by {overload_kg:.2f} kg (+{overload_pct:.2f}%)."
            })

    # 2. Tare Tolerance Check
    if tare_weight is not None and vehicle and vehicle.known_tare_weight:
        tare_val = Decimal(str(tare_weight))
        known_tare = Decimal(str(vehicle.known_tare_weight))
        tare_delta = abs(tare_val - known_tare)
        tare_delta_pct = round((tare_delta / known_tare) * Decimal('100'), 2) if known_tare > 0 else Decimal('0.00')

        # Determine threshold rules (vehicle overrides system default if set)
        allowed_pct = Decimal(str(vehicle.tare_tolerance_pct)) if vehicle.tare_tolerance_pct is not None else Decimal(str(settings.tare_tolerance_pct))
        allowed_kg = Decimal(str(vehicle.tare_tolerance_kg)) if vehicle.tare_tolerance_kg is not None else Decimal(str(settings.tare_tolerance_kg))
        mode = settings.tare_tolerance_mode

        pct_exceeded = tare_delta_pct > allowed_pct
        kg_exceeded = tare_delta > allowed_kg

        is_violation = False
        if mode == 'PERCENTAGE':
            is_violation = pct_exceeded
        elif mode == 'ABSOLUTE':
            is_violation = kg_exceeded
        else:  # EITHER
            is_violation = pct_exceeded or kg_exceeded

        if is_violation:
            violations.append({
                'type': 'TARE_TOLERANCE_EXCEPTION',
                'rule': 'Tare Tolerance Exceeded',
                'actual': float(tare_val),
                'limit': float(known_tare),
                'delta': float(tare_delta),
                'delta_pct': float(tare_delta_pct),
                'allowed_pct': float(allowed_pct),
                'allowed_kg': float(allowed_kg),
                'message': f"Tare weight ({tare_val:.2f} kg) deviates from registered known tare ({known_tare:.2f} kg) by {tare_delta:.2f} kg ({tare_delta_pct:.2f}%). Limit: {allowed_pct:.1f}% or {allowed_kg:.0f} kg."
            })

    return violations
