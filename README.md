# TraceProv Study Portal

Static frontend for the TraceProv password-protected human-validation study.

This repository is intended for GitHub Pages deployment. It contains the selected APGs and password hashes for the lightweight study-login experience. It is not a security boundary: static web assets can be inspected by a motivated visitor.

## Google Forms collection

Create a Google Form with these four fields, then link its Responses tab to a Google Sheet:

1. `reviewer_id` -- short answer
2. `case_id` -- short answer
3. `submitted_at` -- short answer
4. `annotation_json` -- paragraph answer

Set the form to accept responses from anyone with the link if reviewers do not have university Google accounts. In `config.js`, replace the form response URL and the four `entry.<number>` names. The site submits one complete 16-question validation as one Google Form response after the reviewer presses **Submit completed case**. The Sheet can be downloaded as CSV through `File > Download > Comma-separated values`.

Google Forms does not reveal a successful cross-origin response to browser JavaScript, so the portal reports a successful send after the request is handed to the browser. The linked response sheet is the authoritative record.
