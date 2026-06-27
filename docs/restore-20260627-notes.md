# Restore Notes

Base restore commit in this repo:
- `34c6e75` (`mobile 2`, June 6, 2026)

Branches kept for safety:
- `restore-34c6e75-20260627`: pure June 6 restore point
- `restore-34c6e75-selected-features`: working branch for selective reapply
- `backup-main-before-34c6e75-20260627`: latest integrated web backup from `5787081`

Features already re-applied in this repo:
- Unified web `Explore by Category`
- Files:
- `apps/web/components/MainPortal.js`
- `apps/web/lib/portalHotels.js`

Features preserved in the separate admin repo:
- Repo path: `C:\Users\jjcho\hotel-pms-admin`
- `Company Workflow`: `src/FloatingApprovalInbox.jsx`, `src/pages/ApprovalCenter.jsx`
- `Event POS`: `src/pages/EventPos.jsx`
- Event POS entry button: `src/pages/Home.jsx`

Notes:
- This repo and the admin repo are separate codebases.
- The June 6 restore was applied only to `C:\Users\jjcho\n-plus-solution`.
