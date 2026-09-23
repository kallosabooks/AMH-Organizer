# Client Onboarding Tracker

There are two versions:

- **Google Sheets version (for teams):** in the [`google-sheets-version`](google-sheets-version/) folder. Everyone in your Google Workspace uses the same board, and the data is stored and backed up in a Google Sheet. Follow [google-sheets-version/SETUP.md](google-sheets-version/SETUP.md).
- **Single-file version (just you, one computer):** `index.html`, described below.

---

A simple board for tracking clients through your onboarding stages. It's a single file (`index.html`) that runs in your web browser. You don't need to install anything, and there's no login or internet connection required.

## How to open it

1. Download `index.html` to your computer (for example, into your Documents folder).
   - On GitHub: open the file, then click the **Download raw file** button (the down-arrow icon near the top right).
2. Double-click `index.html`. It opens in your default browser (Chrome, Edge, Safari or Firefox).
3. Optional: bookmark the page so you can get back to it quickly.

Always open the **same file in the same browser**. Your data is saved inside that browser for that file. If you move the file, use a different browser, or open it on another computer, the board will be empty. Use Backup → Import to bring your data over.

## How to use it

| To… | Do this |
| --- | --- |
| Add a client | Click **+ Add Client**, fill in the business name (required), client name (optional) and any notes, then click **Add Client**. |
| Move a client to another stage | Drag the card to a different column. You can also open the card and change the **Stage** dropdown, which is easier on a tablet. |
| View or edit a client | Click the card. Edits save automatically. Click **Done** when you're finished. |
| Add a note | Open the card, type in the "Add an update" box and click **Add Note**. Each note is saved with the date and time, newest first. Stage moves are logged in the history automatically. |
| Delete a client | Open the card and click **Delete Client**. You'll be asked to confirm. |
| Change the order of cards | Use the **Sort** menu at the top: alphabetically by business or client name, by time in the current stage, or by the date the client was added. Your choice is remembered. |
| Find a client | Type in the search bar (or press `/`) to filter by client or business name. |
| Rename, add, remove or reorder stages | Click **Edit Stages**. If you delete a stage that still has clients, they're moved to the neighbouring stage. |
| Back up your data | **Backup → Export backup (JSON)** saves a full copy. **Export spreadsheet (CSV)** saves a file you can open in Excel or Google Sheets. |
| Restore from a backup | **Backup → Import from file…**, then choose a `.json` or `.csv` file you exported earlier. This **replaces** what's currently on the board. |

Each card shows the business name, the client's name underneath (if entered), the client entered their current stage, and how many days they've been there.

## Keeping your data safe

- Everything saves automatically in your browser as you work.
- Clearing your browser history or site data (cookies and site data) **will erase the board**. Export a JSON backup regularly, for example once a week, and keep it somewhere safe.
- Private or incognito windows don't keep data after you close them.

## Sharing with a team

This version keeps data on one computer, in one browser. If several people need to see and edit the same board, it would need a shared database and a hosted website (with logins). The current backup/import files can be used to move existing data into that version.
