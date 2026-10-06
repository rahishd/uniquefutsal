# FRD-003 Children's Academy

Guardians of children aged 10 to 14 confirm a football class in the app.

## Customer
- Popular tile "Children's Academy" opens `/academy`. Sign-in required.
- Form: guardian name and contact number, emergency contact number (different), address; child name, age 10 to 14, health status (healthy / condition with notes); class time chosen from staff-published sessions; Terms and Conditions with an accept tick.
- Result: confirmation code AC-XXXXXX, a list of the guardian's enrolments, cancel until the class starts.

## Admin (staff)
- Classes: create (optionally repeating weekly), set capacity, coach, visibility (a class is shown to guardians only when visible), cancel (cancels enrolments and notifies guardians).
- Enrolled children: guardian, emergency contact, address, child, health notes; mark attended / no show; cancel an enrolment.
- Terms: edit text; every save raises the version and guardians must accept the current version.

## Rules enforced on the server
Age range, phone format, seats (row lock), duplicate child per class, 5 enrolments per day per guardian, started/hidden/cancelled classes refused, terms version must match.

## Open points
Fees (none yet: paid at the venue per the default terms), minimum notice for cancelling, waiting list when full.
