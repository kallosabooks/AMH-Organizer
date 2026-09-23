# Client Onboarding Tracker: Google Sheets version

This version stores everything in a Google Sheet and runs as a web page that everyone in your Google Workspace can open. People sign in with their normal Google work account, so there are no extra passwords, and everyone sees the same board.

Setup takes about 10 minutes and only needs to be done once, by you.

---

## Before you start: which Google account?

Do the setup while signed in to your **Google Workspace account** (your business email, e.g. `you@yourbusiness.com`), not a personal `@gmail.com` account. Only a Workspace account can limit access to "anyone in my organization". If you only have a personal Gmail account, follow the setup below but use the settings in [Using a personal Gmail account](#using-a-personal-gmail-account) in step 5.

You'll need two files from the `google-sheets-version` folder: **Code.gs** and **Index.html**.

---

## Step 1: Create the Google Sheet

1. Go to [sheets.new](https://sheets.new) to create a blank spreadsheet.
2. Click "Untitled spreadsheet" at the top left and name it **Client Onboarding Tracker**.

## Step 2: Open the script editor

1. In the spreadsheet menu, click **Extensions → Apps Script**. A new tab opens.
2. Click "Untitled project" at the top and rename it **Client Onboarding Tracker**.

## Step 3: Paste in the two files

**Code.gs**
1. You'll see a file called `Code.gs` containing `function myFunction() { }`.
2. Select everything in it (Ctrl+A) and delete it.
3. Open the provided **Code.gs** in Notepad, copy everything (Ctrl+A, Ctrl+C) and paste it in (Ctrl+V).

**Index.html**
1. In the left panel, click the **+** next to "Files" and choose **HTML**.
2. Type the name **Index** exactly as shown, with a capital I. Don't add `.html`, because Google adds it.
3. Delete the starter text in the new file.
4. Open the provided **Index.html** in Notepad, copy everything and paste it in.

Click the **💾 Save** icon (or Ctrl+S).

## Step 4: Run the one-time setup

1. At the top of the editor, find the dropdown next to **▷ Run** and **Debug**. Choose **setUp**.
2. Click **▷ Run**.
3. Google asks for permission:
   - Click **Review permissions** and choose your account.
   - If you see "Google hasn't verified this app", click **Advanced**, then **Go to Client Onboarding Tracker (unsafe)**. This is expected: the "app" is the script you just pasted into your own account.
   - Click **Allow**.
4. Wait for "Execution completed" at the bottom.

Your spreadsheet now has three tabs: **Clients**, **Notes** and **Stages**. A nightly backup has also been scheduled (see [Backups](#backups)).

## Step 5: Publish it as a web app

1. At the top right, click **Deploy → New deployment**.
2. Click the ⚙️ gear next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** `Client tracker`
   - **Execute as:** **Me** (your email)
   - **Who has access:** **Anyone within [your organization's name]**
4. Click **Deploy**. If it asks for permission again, allow it the same way as in step 4.
5. Copy the **Web app URL**. This is the link to your tracker.

## Step 6: Share it with your team

- Send the Web app URL to your team and ask them to bookmark it.
- They open it while signed in to their work Google account. They don't need access to the spreadsheet itself.
- Anyone outside your organization who tries the link is blocked by Google.

## Step 7: Bring over your existing clients (optional)

If you've already entered clients in the original single-file version:

1. Open your old `index.html` in the Chrome where your data is, then click **Backup → Export backup (JSON)**.
2. Open the new web app, click **Backup → Import from file…** and choose that JSON file.

---

## How it works day to day

- **Saving:** changes save to the Google Sheet automatically. The status under the title shows "Saving…" and then "All changes saved".
- **Teammates' changes:** these appear on your screen within about 30 seconds, with no refresh needed. Two people can work on the board at once, even on the same client, and neither overwrites the other.
- **Who did what:** each note shows who added it, and each client shows who last updated it.
- **The Google Sheet:** it always holds an up-to-date, readable copy of the board. **Backup → Open Google Sheet** opens it (you, or anyone you share the sheet with).
  - Use the web app for changes rather than editing the Clients, Notes or Stages tabs directly. The app rewrites those tabs on every save.
  - For your own reports or charts, add a separate tab. The app never touches other tabs.

## Backups

You have three layers of protection:

1. **Nightly copies.** Every night around 2 AM, a copy of the data is saved to a Google Drive folder called **Client Tracker Backups**. The last 30 are kept. A copy is also made automatically just before anyone uses Import.
2. **Google Sheets version history.** In the spreadsheet, go to **File → Version history → See version history** to restore any earlier point in time.
3. **Manual exports.** **Backup → Export backup (JSON)** or **Export spreadsheet (CSV)** downloads a copy to your computer.

To make a backup right now, open the script editor, choose **backupNow** in the dropdown and click **▷ Run**.

## Updating the app later

If you receive a new version of `Code.gs` or `Index.html`:

1. Open the spreadsheet, go to **Extensions → Apps Script** and paste the new contents over the old ones. Save.
2. Click **Deploy → Manage deployments**, click the ✏️ pencil, set **Version** to **New version**, then click **Deploy**.

The web address stays the same, so your team doesn't need a new link.

## Using a personal Gmail account

The "Anyone within [your organization]" option only exists for Google Workspace accounts. With a personal `@gmail.com` account, use these settings in step 5 instead:

- **Execute as:** **User accessing the web app**
- **Who has access:** **Anyone with Google account**

Then share the **spreadsheet** (the Share button, as **Editor**) with each teammate's email. Only people you've shared the sheet with can load the board. Everyone else gets an error. Each teammate will see the same one-time permission screen as in step 4 on their first visit.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Script function not found: doGet" | The Code.gs contents weren't pasted or saved. Repeat step 3 and save. |
| Blank page, or "No HTML file named Index" | The HTML file must be named exactly `Index`. Rename it in the left panel. |
| "You need access" / "Sorry, unable to open the file" | The person isn't signed in with a work account in your organization. For the Gmail setup, the spreadsheet hasn't been shared with them. |
| Status says "Offline — can't reach Google Sheets" or "Couldn't save — retrying…" | Check the internet connection. The app retries a few times. If it still can't save, it tells you and reloads the board, and you'll need to re-enter your last change. |
| Changes don't show up after updating the code | Create a **New version** under **Manage deployments** (see "Updating the app later"). |
