
## Collected Issues - $DATE

### Issue 1: UI Dark Mode Not Respecting System Preference
**Status:** 🔴 Active  
**Location:** `frontend/src/routes/login/+page.svelte`, Heartwood dashboard  
**Severity:** Medium  
**Description:** 
The login page and Heartwood dashboard are not respecting dark mode. The UI appears in light mode even when the system/browser is set to dark mode. The seasonal background gradients are rendering but the card/content areas remain light.

**Expected:**
- Dark mode should work consistently across login page and Heartwood dashboard
- Glass/card components should adapt to dark theme
- Text colors should invert properly for dark backgrounds

**Technical Notes:**
- The `seasonalBg` derived store is working
- Glass component from `@autumnsgrove/groveengine/ui` may need chameleon integration pass
- Check `dark:` Tailwind classes are properly applied

**Next Steps:**
- [ ] Audit all components for dark mode support
- [ ] Ensure `darkMode: 'class'` or media query is configured in Tailwind
- [ ] Test seasonal backgrounds in both light and dark modes
- [ ] Apply chameleon theming pattern for dynamic dark mode

---

### Issue 2: Passkey Setup Completion Flow Missing
**Status:** 🟡 Discovery  
**Location:** `frontend/src/routes/dashboard/security/+page.svelte`  
**Severity:** Medium  
**Description:**
When a user doesn't have a passkey set up yet, there's no clear flow to create one. The passkey sign-in button works (triggers Bitwarden/browser to check), but if no passkeys exist, the user needs a way to register one.

**Expected:**
- After successful OAuth login, prompt user to set up a passkey
- Dashboard security page should have clear passkey registration UI
- First-time users should be guided through passkey setup

**Technical Notes:**
- `registerPasskey()` function exists in `auth/client.ts`
- Dashboard security page exists at `/dashboard/security`
- Need to check if Better Auth handles passkey registration properly

**Next Steps:**
- [ ] Verify passkey registration works on `/dashboard/security`
- [ ] Add post-login prompt for passkey setup (if no passkeys exist)
- [ ] Create guided passkey setup flow for new users
- [ ] Test passkey deletion and re-registration

---

