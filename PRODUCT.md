# Product

## Users

Vulcan Club organisers approving manual UPI payments and admitting Hack-O-Lantern teams.

## Purpose

An internal-only operations app, separate from the public event site. It protects attendee data while allowing organisers to review payment references, issue entry tickets, check attendees in once, search teams, and export a CSV.

## Constraints

- Authentication is a passcode kept only in environment variables.
- The browser never receives database credentials or a Supabase secret.
- A ticket exists only after an organiser approves the submitted ₹300 UPI reference.
- All real registration data comes from the API. No sample attendee data is shown.
- Check-in must be usable on a phone in a dim entry environment.

## Design direction

True-black flat, inherited from the event’s night setting but deliberately quieter: orange is reserved for payment-review status and green for a successful entry. The central working object is an event-door queue rather than generic metrics.
