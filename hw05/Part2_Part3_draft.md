# Part 2

**1. Prompts used with Claude**

- "i did part 1 run part 2 and 3" (with the assignment PDF attached)
- "do whatever you need" (approving Claude's fix for the Docker networking problem described below)

Claude read `README.md`, `start.sh`, `docker-compose.yaml` and `Deployment Notes/Instructions.md` and found that the project runs as 11 Docker containers. Each of the three subsystems (Guest Info, Inventory and Reporting) has a frontend, a backend and a MongoDB database. A RabbitMQ message broker connects the subsystems, and a Traefik proxy sits in front. The intended startup is `start.sh` (or `start.cmd` on Windows), which runs `docker compose pull`, clears stale MongoDB lock files, runs `docker compose up` and opens the three frontends.

**2. Running the Deployment project**

```
cd deployment
docker compose pull
rm -f data/*/mongod.lock data/*/WiredTiger.lock
docker compose up -d
```

| Interface | URL |
|---|---|
| Guest Info System | http://localhost:10300 |
| Inventory System | http://localhost:10301 |
| Reporting System | http://localhost:10302 |
| RabbitMQ management (guest/guest) | http://localhost:15672 |
| Backends (API) | :10350 guest, :10351 inventory, :10352 reporting |

Problem encountered: all containers started, but every backend failed to connect to its MongoDB database. The inventory backend exited with `MongoServerSelectionError: connection timed out`, and the guest backend returned HTTP 500 errors with `DB Connected: false`. Claude traced this to the GitHub Codespace and not to BNM. Leftover legacy iptables rules set the FORWARD policy to DROP and allowed only the default `docker0` bridge. As a result, traffic on the custom networks that Docker Compose creates (`guest-network`, `inventory-network`, `reporting-network`) was dropped. The fix was:

```
sudo iptables-legacy -I FORWARD -i br-+ -j ACCEPT
sudo iptables-legacy -I FORWARD -o br-+ -j ACCEPT
docker compose restart inv-backend guest-backend reporting-backend
```

After the fix, all three backends connected and the system worked end to end.

**3. Screenshots:** `p2-guest-home.png`, `p2-inventory-home.png`, `p2-reporting-home.png`

---

# Part 3

The user stories were verified against the running `release-spring2026deployment` images, using the three web UIs. Where the UI did not explain a behavior, I checked the matching source code on the `release/spring2026Deployment` branch.

## Staff 1 – Guest Verification

**How verified:** In the Guest Info System (port 10300) I tried three IDs: an alphanumeric ID (`AB1234567`), a 9-digit ID (`123456789`) and a new 6-digit ID (`482913`). For the new ID, I filled in resident status, grad/undergrad, graduating year and year issued, then clicked Submit. I then re-entered the same ID to confirm that the guest and the visit had been saved.

**Screenshots:** `s1-a-alphanumeric-rejected`, `s1-b-nine-digits-truncated`, `s1-c-six-digit-id-entered`, `s1-d-guest-form-filled`, `s1-e-returned-to-main-screen`, `s1-f-returning-guest-weekly-visits`

**Anomalies:**
- **ID format contradicts the requirement.** The story says IDs are "9 alphanumeric characters in any order." The UI accepts **only digits**, stops input at **6 digits**, and silently adds the prefix `000` (so `482913` is stored as `000482913`). Typing `AB1234567` removed the letters, kept `123456`, and still enabled the submit button. The guest backend's API does allow `^[a-zA-Z0-9]{9}$`, so the frontend and backend disagree with each other as well as with the story.
- **No real "verification" of membership.** The story says staff "verify that the guest is a member." Any unknown ID is simply treated as a new guest ("Guest not found. Fill in the form and click Submit to add this guest."). The system records guests; it does not verify them against any membership list.
- **Data collected differs.** The story lists "graduation year" twice and does not mention **Year Issued**, which the system requires. Resident status appears as the question "Is the guest a WNE on-campus resident? Yes/No" rather than "commuter or live on campus."
- **Returns to main screen:** this works, because the page reloads after Submit. However, the "Visit recorded successfully" message is cleared by the immediate reload, so staff get no visible confirmation.
- **Behavior not in the story:** a "Number of visits this week" counter for returning guests, and a **Remove Guest** button.

## Staff 2 – Log Incoming Inventory

**How verified:** In the Inventory System (port 10301) I opened Inventory and used **Quick Entry**. First I entered a malformed UPC (`12345`). Next I entered a UPC that had never been in the system (`099999999999`) with no name. Finally I entered the same UPC with a name and quantity. I also started an **Inventory Session**, added `041196910759` (24 units) and clicked Submit. Both items then appeared in the inventory and in the Reporting system.

**Screenshots:** `s2-a-inventory-page`, `s2-b-bad-upc-format`, `s2-c-unknown-upc-no-lookup`, `s2-d-quick-entry-added`, `s2-e-session-item-added`, `s2-f-session-submitted`, `s2-g-after-submit-returns-home`

**Anomalies:**
- **No item lookup, so "found" and "not found" never happen.** The story says that if the item is found the system returns to the scanning screen, and if it is not found a message is shown. In the system, the UPC is never looked up. Staff must type the **name and quantity by hand for every item**, and an unknown UPC is accepted and created as a new item. The only messages are input-validation errors (for example, "UPC must be exactly 12 digits," "Item name is required").
- **UPC restricted to exactly 12 digits.** This is not stated in the story, and it rejects other common barcode formats such as EAN-13 and UPC-E.
- **Restocking an existing item is blocked in Quick Entry.** Quick Entry rejects a UPC that is already in inventory ("Duplicate UPC: this UPC has already been added"). Incoming stock for an existing item can only be logged through an Inventory Session.
- **Two different entry flows.** After Submit, an Inventory Session goes back to the **home page**, not to a scanning screen. Quick Entry stays on the same page. The story describes a single flow.
- **Scanning** could not be tested without the hardware. Per `Instructional Media/ScannerSetup.md`, the scanner behaves like a keyboard, so a scan is equivalent to typing the UPC into the field.

## Staff 3 – Identify Expired Inventory

**How verified:** I searched all three UIs for any expiration-date input or expired-items report, and checked the inventory data model (`Item`: upc, name, quantity, glutenFree, category).

**Screenshots:** `s3-a-no-expiration-field` (the Quick Entry form has no expiration field)

**Anomalies:**
- **Not implemented.** There is no way to enter an expiration date when logging inventory, the database stores no expiration date, and there is no screen for entering a date to check for expired items. The requirement cannot be met in the current system, including the "blank report if none" case.

## Staff 4 – Remove Expired Inventory

**How verified:** Same search as Staff 3. I also looked for any delete or remove action in the Inventory UI.

**Screenshots:** `s3-a-no-expiration-field`, `s2-d-quick-entry-added` (the inventory table has no remove or delete control)

**Anomalies:**
- **Not implemented.** Expiration dates are not stored, so items cannot be removed by expiration date, and no removal report exists. The main Inventory page cannot remove items at all. The backend has a `DELETE /inventory/{upc}` API, but no UI uses it. The "Remove" button inside an Inventory Session only removes a line from the session before it is submitted.
- This story depends on Staff 3 (expiration data must exist first), but the documentation does not state that dependency.

## Admin 1 – Generate Guest Visit Report

**How verified:** In the Reporting System (port 10302) under **Guest Reports**, I ran three date ranges: `03-01-2026` to `10-02-2026`, which includes the visit recorded in Staff 1; `01-01-2026` to `01-31-2026`, which has no visits; and a range where the start date is after the end date.

**Screenshots:** `a1-a-visit-report`, `a1-b-no-visits-range`, `a1-c-start-after-end`

**Anomalies:**
- **Required fields are missing.** The story requires guest ID, grad or undergrad, commuter status and graduation year. The report shows only **BNMID and Date**, plus a Total Visits count; the CSV download adds a per-guest Visit Count. The visit messages the Guest system sends to Reporting contain only BNMID and date, so Reporting has no access to the other fields.
- **The empty-report case differs.** The story says an empty report is shown. The system instead displays the message "No visits found for the given date range" (the backend returns HTTP 404).
- **Dates are free-text fields** in strict `MM-DD-YYYY` format, with no date picker. Future dates are rejected, which the story does not mention.
- **Role wording is inconsistent.** The story begins with "As an administrator" but its confirmation steps say "the staff member enters." The system has no login or roles, so anyone with access to the machine can run this report.

## Admin 2 – Generate Inventory Report

**How verified:** Under **Inventory Reports**, I searched `09-01-2026` to `10-02-2026` and got "No reports found." Reports are produced only by a nightly job, so I triggered today's snapshot through the Reporting API (`POST /reports {"date":"10-02-2026"}`, the same message the nightly job sends). I then searched again and opened the report.

**Screenshots:** `a2-a-inventory-reports-default`, `a2-b-inventory-reports-range`, `a2-c-report-list-with-snapshot`, `a2-d-report-detail`, `a2-e-single-day-range`

**Anomalies:**
- **Reports exist only for days with a saved snapshot.** A scheduled job in the inventory backend saves a snapshot **once a day at 11:59 PM Eastern**. An administrator cannot request inventory for an arbitrary date, or for "now." If the machine was off at 11:59 PM, that day has no report at all. On a fresh run, there are no reports until the first night.
- **Input differs from the story.** The story says the administrator enters **one date**. The UI asks for a **date range**, lists matching snapshot dates, and requires clicking a date to see the report.
- **Report contents:** UPC, Name and **Quantity**, plus a CSV download. This covers what the story asks for and adds quantity.
- **The empty case** shows "No reports found for the given date range" rather than an empty report; an empty snapshot shows "No items."
- The story uses both "administrator" and "staff member," and there is no role enforcement.
