# XPENG Analytics 1.5.0

Version 1.5.0 is the largest update since the first public release. It keeps
the same local-only privacy model while making large imports faster and the
resulting dashboard substantially more detailed.

## Highlights

### Much faster, progressive imports

The normal importer now streams XPENG CSV data in a dedicated JavaScript Web
Worker and stores only the required signals in typed columns. Multiple ZIPs are
processed one at a time, and the complete dashboard appears after the first
file while later files continue updating the same session.

Progress messages are throttled and unchanged charts are not re-rendered during
import, improving Firefox performance without changing the resulting metrics.

### Deeper journey and driving analysis

- synchronized journey charts for direct comparison at one elapsed time;
- speed, power, SOC, displayed range, and battery temperature;
- longitudinal and lateral forces, pedal use, steering, motor torque and speed,
  rotor temperature, and four-tyre telemetry when available;
- estimated driving profile, clearly labelled as a software estimate;
- dynamic-event and signal-availability summaries.

### Charging and battery improvements

- separate AC/DC energy totals and charging colours;
- charging habits, recurring limits, and repeated start-time patterns;
- synchronized charging tooltips containing all technical values for the same
  instant;
- real-world and XPENG-indicated range comparisons;
- SOC and battery-temperature ranges, parked use, capacity, and relative SOH;
- calculated values remain clearly distinguished from official BMS readings.

### Dedicated tyres area and unit controls

Tyre pressure has moved to its own section with full-scale four-tyre trends and
axle-imbalance analysis. The sidebar now supports Metric/Imperial units and an
independent bar/psi selector.

### Better reports

The local PDF report now includes the highest-distance day, average and longest
journey, regeneration share, AC/DC energy, peak charging power, daily details,
charging details, optional cost estimates, project authorship, and the public
site address.

### Portable history v3

New `.xpeng` files use individually compressed column blocks with integrity
checks. They are designed to restore faster and stay close to the size of the
original XPENG ZIP. Existing version 1 and 2 histories remain importable.

## Privacy and compatibility

All vehicle processing remains inside the browser tab. No application backend,
account, cloud database, advertising, or analytics service is used. Portable
histories are compressed but not encrypted.

Firefox, Chrome, and Edge are the supported browsers. Other modern browsers may
work but are not currently verified.

## Credits

XPENG Analytics is created and maintained by Miguel Pinto. The fast import
architecture was inspired by [LogbooX](https://github.com/schliflo/logboox) by
Florian Schlittenbauer and is acknowledged under its MIT licence.

XPENG Analytics is an independent community project and is not affiliated with,
endorsed by, or sponsored by XPENG.
