from __future__ import annotations

from dataclasses import dataclass
from typing import Callable


QUALITY_INVALID = 1


@dataclass(frozen=True)
class Rule:
    code: str
    description: str
    severity: str
    invalid: Callable[[float], bool]


RULES: dict[str, dict[str, Rule]] = {
    "operation": {
        "esp_vehspd": Rule("speed_range", "Speed must be between 0 and 220 km/h", "high", lambda x: x < 0 or x > 220),
        "eps_steeringangle": Rule("steering_range", "Steering angle must be within +/-900 degrees", "medium", lambda x: abs(x) > 900),
        "eps_steeringanglespd": Rule(
            "steering_speed_range",
            "Steering angular velocity must be within +/-2000 degrees per second",
            "medium",
            lambda x: abs(x) > 2_000,
        ),
        "cdcu_totalodometer": Rule("odometer_range", "Odometer must be non-negative and below 2,000,000 km", "high", lambda x: x < 0 or x > 2_000_000),
    },
    "energy": {
        "bms_battvolt": Rule("pack_voltage_range", "Pack voltage must be between 250 and 800 V", "high", lambda x: x < 250 or x > 800),
        "bms_battcurr": Rule("pack_current_range", "Pack current must be within +/-1000 A", "high", lambda x: abs(x) > 1000),
        "ldcu_chrgpwr": Rule("charge_power_range", "Charge power must be between 0 and 400 kW", "high", lambda x: x < 0 or x > 400),
        "ldcu_bms_soc_disp": Rule("soc_range", "State of charge must be between 0 and 100 percent", "high", lambda x: x < 0 or x > 100),
        "bms_batttempmax_gb": Rule("battery_temp_range", "Battery temperature must be between -30 and 90 C", "high", lambda x: x < -30 or x > 90),
        "bms_batttempmin_gb": Rule("battery_temp_range", "Battery temperature must be between -30 and 90 C", "high", lambda x: x < -30 or x > 90),
        "ldcu_dstbatdisp_dynamic": Rule("range_display_range", "Displayed range must be between 0 and 1000 km", "medium", lambda x: x < 0 or x > 1000),
    },
    "status": {
        "ldcu_tpmsprfl": Rule("tyre_pressure_range", "Tyre pressure must be between 100 and 400 kPa", "high", lambda x: x < 100 or x > 400),
        "ldcu_tpmsprfr": Rule("tyre_pressure_range", "Tyre pressure must be between 100 and 400 kPa", "high", lambda x: x < 100 or x > 400),
        "ldcu_tpmsprrl": Rule("tyre_pressure_range", "Tyre pressure must be between 100 and 400 kPa", "high", lambda x: x < 100 or x > 400),
        "ldcu_tpmsprrr": Rule("tyre_pressure_range", "Tyre pressure must be between 100 and 400 kPa", "high", lambda x: x < 100 or x > 400),
    },
}


def parse_number(raw: str | None) -> float | None:
    if raw is None or raw.strip() == "":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def normalise_number(family: str, source_field: str, raw: str | None) -> tuple[float | None, bool]:
    value = parse_number(raw)
    if value is None:
        return None, False
    rule = RULES.get(family, {}).get(source_field)
    if rule and rule.invalid(value):
        return None, True
    return value, False

