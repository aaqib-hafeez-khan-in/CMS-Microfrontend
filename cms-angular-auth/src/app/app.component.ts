import { Component, OnDestroy, OnInit } from '@angular/core';
import { AUTH_EVENTS, can, CmsPermission, CmsSession, CmsUser, ROLE_PERMISSIONS, Role, publishAuthEvent } from './auth-contract';

interface DemoAccount extends CmsUser {
  password: string;
}

@Component({
  selector: 'app-root',
  template: `
    <div class="auth-page animate-in">
      <header class="page-header">
        <div>
          <p class="eyebrow">CMS ULTRA · IDENTITY BOUNDARY</p>
          <h2>Identity &amp; Access</h2>
          <p class="subtitle">Client-side authentication and role-based access for the portfolio CMS.</p>
        </div>
        <span class="module-tag">Angular 11</span>
      </header>

      <div *ngIf="notice" class="notice" [class.error]="noticeType === 'error'" [class.success]="noticeType === 'success'">{{ notice }}</div>

      <section *ngIf="!currentUser" class="auth-card">
        <div class="card-icon">🔐</div>
        <h3>Sign in to CMS Ultra</h3>
        <p class="muted">Use one of the intentionally fake demo accounts below. No real credentials are used or persisted.</p>
        <form (ngSubmit)="onLogin()" novalidate>
          <label>Email<input type="email" [(ngModel)]="email" name="email" autocomplete="username" required></label>
          <label>Password<input type="password" [(ngModel)]="password" name="password" autocomplete="current-password" required></label>
          <p *ngIf="loginError" class="field-error">{{ loginError }}</p>
          <button class="primary" type="submit" [disabled]="loading">{{ loading ? 'Signing in…' : 'Sign in' }}</button>
        </form>
        <div class="demo-accounts">
          <p class="section-label">Demo accounts</p>
          <button type="button" *ngFor="let account of demoAccounts" (click)="selectDemo(account)">
            <strong>{{ account.role }}</strong><span>{{ account.email }}</span>
          </button>
          <p class="hint">Select an account to populate the demo login form.</p>
        </div>
      </section>

      <section *ngIf="currentUser" class="workspace">
        <div class="session-card">
          <div class="avatar">{{ currentUser.name[0] }}</div>
          <div class="identity"><strong>{{ currentUser.name }}</strong><span>{{ currentUser.email }}</span><span class="role-badge">{{ currentUser.role }}</span></div>
          <div class="session-meta"><span class="status">● Active session</span><span>Expires {{ expiryLabel }}</span><button type="button" class="secondary" (click)="onLogout()">Sign out</button></div>
        </div>

        <div class="grid">
          <article class="panel">
            <div class="panel-heading"><div><p class="section-label">Authorization</p><h3>Your CMS permissions</h3></div></div>
            <div class="permission" *ngFor="let permission of permissions"><span>{{ permissionLabels[permission] }}</span><span [class.allowed]="hasPermission(permission)">{{ hasPermission(permission) ? 'Allowed' : 'Restricted' }}</span></div>
          </article>

          <article class="panel" *ngIf="isAdministrator()">
            <div class="panel-heading"><div><p class="section-label">Administrator</p><h3>User &amp; role management</h3></div><span class="admin-badge">ADMIN</span></div>
            <div class="user-row" *ngFor="let user of managedUsers"><div><strong>{{ user.name }}</strong><span>{{ user.email }}</span></div><select [ngModel]="user.role" (ngModelChange)="changeRole(user, $event)"><option *ngFor="let role of roles" [value]="role">{{ role }}</option></select></div>
            <p class="muted small">Role changes are demo-only and remain in browser storage. Passwords are never displayed.</p>
          </article>

          <article class="panel unauthorized-panel" *ngIf="!isAdministrator()">
            <div class="panel-heading"><div><p class="section-label">Restricted area</p><h3>Administrator controls</h3></div><span>🔒</span></div>
            <p class="muted">User and role management is available to Administrators only. Your current role is {{ currentUser.role }}.</p>
          </article>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .auth-page { max-width: 1180px; margin: 0 auto; padding: 2.5rem; color: var(--text-main); }
    .page-header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid var(--border); padding-bottom:2rem; margin-bottom:2rem; gap:2rem; }
    .eyebrow,.section-label { margin:0 0 .45rem; color:var(--primary-accent); font-size:.72rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    h2 { margin:0; color:var(--primary); font-size:2.4rem; letter-spacing:-.04em; }
    h3 { margin:.15rem 0; color:var(--primary); font-size:1.25rem; }
    .subtitle,.muted { color:var(--text-muted); line-height:1.6; }
    .auth-card { max-width:520px; margin:3rem auto; padding:2.5rem; background:#fff; border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow-lg); }
    .card-icon { width:64px; height:64px; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; border-radius:16px; background:var(--primary-gradient); font-size:2rem; }
    .auth-card > h3,.auth-card > p { text-align:center; }
    form { display:flex; flex-direction:column; gap:1rem; margin-top:1.5rem; }
    label { display:flex; flex-direction:column; gap:.45rem; color:var(--text-muted); font-size:.78rem; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
    input,select { box-sizing:border-box; width:100%; padding:.85rem 1rem; border:1px solid var(--border); border-radius:10px; background:#f8fafc; color:var(--text-main); font:inherit; text-transform:none; letter-spacing:normal; outline:none; }
    input:focus,select:focus { border-color:var(--primary-accent); box-shadow:0 0 0 3px rgba(79,70,229,.1); background:#fff; }
    button { font:inherit; cursor:pointer; }
    .primary { border:0; border-radius:10px; padding:.9rem; background:var(--primary-gradient); color:#fff; font-weight:800; }
    .primary:disabled { opacity:.6; cursor:not-allowed; }
    .secondary { border:1px solid var(--border); border-radius:9px; background:#fff; padding:.55rem .9rem; font-weight:700; }
    .demo-accounts { margin-top:2rem; padding-top:1.5rem; border-top:1px solid var(--border); }
    .demo-accounts button { display:flex; justify-content:space-between; width:100%; padding:.8rem; margin:.45rem 0; border:1px solid var(--border); border-radius:9px; background:#fff; color:var(--text-main); }
    .demo-accounts button span { color:var(--text-muted); }
    .hint,.small { font-size:.78rem; }
    .field-error { color:#dc2626; font-size:.85rem; margin:0; }
    .notice { margin-bottom:1.5rem; padding:1rem 1.1rem; border-radius:10px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-weight:600; }
    .notice.error { background:#fef2f2; color:#b91c1c; border-color:#fecaca; }.notice.success { background:#f0fdf4; color:#15803d; border-color:#bbf7d0; }
    .session-card { display:flex; align-items:center; gap:1rem; padding:1.25rem; margin-bottom:1.5rem; background:#fff; border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow-sm); }
    .avatar { width:52px; height:52px; flex:none; display:flex; align-items:center; justify-content:center; border-radius:14px; background:var(--primary-gradient); color:#fff; font-weight:900; font-size:1.25rem; }
    .identity { display:flex; flex-direction:column; gap:.18rem; min-width:0; }.identity span { color:var(--text-muted); font-size:.82rem; }.role-badge,.admin-badge { align-self:flex-start; padding:.25rem .55rem; border-radius:999px; background:#eef2ff; color:#4338ca; font-size:.68rem; font-weight:800; }
    .session-meta { margin-left:auto; display:flex; align-items:center; gap:1rem; color:var(--text-muted); font-size:.78rem; }.status { color:#15803d; font-weight:800; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:1.5rem; }.panel { padding:1.5rem; background:#fff; border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow-sm); }.panel-heading { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; }
    .permission,.user-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:.8rem 0; border-top:1px solid var(--border); font-size:.88rem; }.permission span:last-child { color:#b91c1c; font-weight:800; font-size:.75rem; }.permission span.allowed { color:#15803d; }.user-row > div { display:flex; flex-direction:column; gap:.2rem; }.user-row span { color:var(--text-muted); font-size:.78rem; }.user-row select { width:150px; padding:.55rem .7rem; }
    .unauthorized-panel { border-style:dashed; }
    @media (max-width:700px) { .auth-page{padding:1.25rem}.page-header,.session-card{align-items:flex-start;flex-direction:column}.session-meta{margin-left:0;flex-wrap:wrap}.auth-card{padding:1.5rem}.grid{grid-template-columns:1fr} }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly storageKey = 'cms_session';
  private readonly usersKey = 'cms_users';
  private readonly sessionDuration = 30 * 60 * 1000;
  private expiryTimer: any;
  private storageHandler = () => this.restoreSession();

  currentUser: CmsUser | null = null;
  email = '';
  password = '';
  loading = false;
  loginError = '';
  notice = '';
  noticeType: 'success' | 'error' = 'success';
  expiryLabel = '';
  managedUsers: CmsUser[] = [];
  roles: Role[] = ['Administrator', 'Editor', 'Contributor'];
  demoAccounts: DemoAccount[] = [
    { id: 'demo-admin', name: 'Admin User', email: 'admin@cms-ultra.demo', role: 'Administrator', password: 'AdminDemo123!' },
    { id: 'demo-editor', name: 'Editor User', email: 'editor@cms-ultra.demo', role: 'Editor', password: 'EditorDemo123!' },
    { id: 'demo-contributor', name: 'Contributor User', email: 'contributor@cms-ultra.demo', role: 'Contributor', password: 'ContributorDemo123!' }
  ];
  permissions: CmsPermission[] = ['content.create','content.edit','content.review','content.publish','content.delete','media.manage','collaboration.manage','users.manage'];
  permissionLabels: {[key: string]: string} = {
    'content.create':'Create content','content.edit':'Edit content','content.review':'Review content','content.publish':'Publish content','content.delete':'Delete content','media.manage':'Manage media','collaboration.manage':'Manage collaboration','users.manage':'Manage users & roles'
  };

  ngOnInit(): void {
    this.seedUsers();
    this.restoreSession();
    window.addEventListener('storage', this.storageHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.storageHandler);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
  }

  selectDemo(account: DemoAccount): void {
    this.email = account.email;
    this.password = account.password;
    this.loginError = '';
    this.notice = '';
  }

  onLogin(): void {
    this.loginError = '';
    this.notice = '';
    const email = this.email.trim().toLowerCase();
    if (!email || !this.password) { this.loginError = 'Email and password are required.'; return; }
    const account = this.demoAccounts.find(item => item.email === email && item.password === this.password);
    if (!account) { this.loginError = 'Invalid demo credentials. Select a demo account and try again.'; publishAuthEvent(AUTH_EVENTS.unauthorized, null, 'invalid_credentials'); return; }
    this.loading = true;
    setTimeout(() => {
      const user: CmsUser = { id: account.id, name: account.name, email: account.email, role: account.role };
      const now = Date.now();
      const session: CmsSession = { user, issuedAt: now, expiresAt: now + this.sessionDuration };
      localStorage.setItem(this.storageKey, JSON.stringify(session));
      this.currentUser = user;
      this.loading = false;
      this.password = '';
      this.managedUsers = this.readUsers();
      this.scheduleExpiry(session.expiresAt);
      publishAuthEvent(AUTH_EVENTS.login, session);
      this.noticeType = 'success';
      this.notice = 'Signed in successfully. Your CMS session is active for 30 minutes.';
    }, 300);
  }

  onLogout(): void {
    localStorage.removeItem(this.storageKey);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.currentUser = null;
    this.expiryLabel = '';
    publishAuthEvent(AUTH_EVENTS.logout, null, 'user_logout');
    this.noticeType = 'success';
    this.notice = 'You have been signed out. Protected CMS areas require authentication.';
  }

  hasPermission(permission: CmsPermission): boolean { return Boolean(this.currentUser && can(this.currentUser.role, permission)); }
  isAdministrator(): boolean { return this.currentUser?.role === 'Administrator'; }

  changeRole(user: CmsUser, role: Role): void {
    if (!this.isAdministrator()) { this.noticeType = 'error'; this.notice = 'Unauthorized: only Administrators can change roles.'; publishAuthEvent(AUTH_EVENTS.unauthorized, this.getSession(), 'role_management'); return; }
    if (user.id === this.currentUser?.id && role !== 'Administrator') {
      this.noticeType = 'error'; this.notice = 'The active Administrator cannot remove their own Administrator role.'; return;
    }
    user.role = role;
    localStorage.setItem(this.usersKey, JSON.stringify(this.managedUsers));
    if (user.id === this.currentUser?.id) {
      const session = this.getSession();
      if (session) { session.user.role = role; localStorage.setItem(this.storageKey, JSON.stringify(session)); this.currentUser = session.user; publishAuthEvent(AUTH_EVENTS.login, session, 'role_changed'); }
    }
    this.noticeType = 'success'; this.notice = `${user.name} is now a ${role}.`;
  }

  private restoreSession(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) { this.currentUser = null; return; }
    try {
      const session: CmsSession = JSON.parse(raw);
      if (!session.user || !session.user.id || !session.expiresAt || session.expiresAt <= Date.now() || !ROLE_PERMISSIONS[session.user.role]) {
        localStorage.removeItem(this.storageKey);
        this.currentUser = null;
        publishAuthEvent(AUTH_EVENTS.expired, null, 'invalid_or_expired_session');
        this.noticeType = 'error'; this.notice = 'Your session is no longer valid. Please sign in again.';
        return;
      }
      this.currentUser = session.user;
      this.managedUsers = this.readUsers();
      this.scheduleExpiry(session.expiresAt);
      publishAuthEvent(AUTH_EVENTS.login, session, 'session_restored');
    } catch (_) {
      localStorage.removeItem(this.storageKey);
      this.currentUser = null;
      publishAuthEvent(AUTH_EVENTS.expired, null, 'corrupt_session');
      this.noticeType = 'error'; this.notice = 'The saved session was invalid and has been cleared. Please sign in again.';
    }
  }

  private scheduleExpiry(expiresAt: number): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.updateExpiryLabel(expiresAt);
    this.expiryTimer = setTimeout(() => this.expireSession(), Math.max(0, expiresAt - Date.now()));
  }

  private updateExpiryLabel(expiresAt: number): void { this.expiryLabel = new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  private expireSession(): void {
    localStorage.removeItem(this.storageKey);
    this.currentUser = null;
    this.expiryLabel = '';
    publishAuthEvent(AUTH_EVENTS.expired, null, 'session_timeout');
    this.noticeType = 'error'; this.notice = 'Your session expired. Please sign in again to continue.';
  }

  private seedUsers(): void {
    if (!localStorage.getItem(this.usersKey)) {
      localStorage.setItem(this.usersKey, JSON.stringify(this.demoAccounts.map(({ password, ...user }) => user)));
    }
  }

  private readUsers(): CmsUser[] {
    try { const users = JSON.parse(localStorage.getItem(this.usersKey) || '[]'); return Array.isArray(users) ? users : []; } catch (_) { return []; }
  }

  private getSession(): CmsSession | null {
    try { const session = JSON.parse(localStorage.getItem(this.storageKey) || 'null'); return session; } catch (_) { return null; }
  }
}
