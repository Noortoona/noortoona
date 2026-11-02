# HALA approved identity — 2 November 2026

The owner approved the attached FA480891-308F-4FD9-B671-757BC7622126(1).jpeg
board, specifically its original large upper logo, rather than the subsequent
refinement. Future creative work must retain that chosen silhouette: Arabic هلا,
HALA underneath, and the overlapping open invitation frames with a four-point star
on the right. Ink/navy and champagne gold are the approved presentation.

The committed SVGs contain outlines traced from that reference (with minimal
edge smoothing); no runtime font substitution or remote image service is used.
They are a faithful practical outline extraction, not original designer curves.
Use the same outlines for future print and digital work instead of regenerating
the logo independently. The monocolor SVG supports single-ink applications.

Run `python scripts/brand/render-approved.py` from the repository root to export
the web PNGs, sharing image, and Expo assets. This maintenance script requires
PyMuPDF, Pillow and numpy; normal website/mobile builds require none of them.
The one-time vectorization script additionally needs scipy and the original
1536×1024 approved board as its argument. Its output SVGs are committed.

The Android adaptive foreground is transparent and padded independently from
the opaque launcher icon. Both the native splash background and mobile theme
use the approved navy family. Customer, admin, supervisor and partner headers,
login and initial loading screen use the same full logo.

Updating these files does not replace an installed native application. Android
and iOS require new binaries to update the OS launcher/splash assets; no App
Store/TestFlight upload or production deployment is implied by this change.
