# FRD-005 Site Content: gallery and ads

## Customer app
- Home shows a Gallery (landscape and portrait photos, tap for full screen).
- Ads: header banner (under the company bar), footer banner, an inline banner on Home, and pop-up ads.
- Several live ads in one place loop, each for its own seconds. Pop-ups open after a delay, can close by themselves, and show once per session, once a day or every visit.

## Admin (staff)
- Gallery: upload photos, title and caption, show or hide, reorder, delete. Orientation is detected.
- Ads: upload the picture, choose the place (header, footer, inline, pop-up), link (in-app page or https address), seconds per ad, priority, and targeting: date range, hours of the day (for example 6:00 to 7:00 AM for one hour), weekdays. Pause, edit, delete. See whether each ad is live now, scheduled or ended, plus views and clicks.

## Rules enforced on the server
Only JPG, PNG or WebP; decoded and re-encoded, location data removed, shrunk to 1600px; links must start with / or https://; targeting is evaluated by the server in Nepal time; counters only count live ads.

## Open points
Maximum 100 photos and 100 ads; recommended sizes are shown in the admin form; video ads are not supported; contact details and venue Wi-Fi from the old module list are not part of this version.
