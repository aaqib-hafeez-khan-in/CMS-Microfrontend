import { registerApplication, start, LifeCycles, navigateToUrl } from "single-spa";
import { constructApplications, constructRoutes, constructLayoutEngine } from "single-spa-layout";

const layoutElement = document.getElementById('single-spa-layout') as HTMLTemplateElement;

if (!layoutElement) {
  console.error('Single-SPA layout template not found!');
}

const routes = constructRoutes(layoutElement);
const applications = constructApplications({
  routes,
  loadApp: ({ name }: { name: string }) => {
    console.log(`[Shell] Loading MFE: ${name}`);
    return System.import(name) as Promise<LifeCycles>;
  }
});

const layoutEngine = constructLayoutEngine({ routes, applications, active: true });

const protectedRoutes = [
  '/cms-root-orchestration/editorial',
  '/cms-root-orchestration/collab',
  '/cms-root-orchestration/media'
];

const getValidSession = (): any | null => {
  const raw = localStorage.getItem('cms_session');
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (!session || !session.user || !session.user.id || !session.user.role || !session.expiresAt || session.expiresAt <= Date.now()) {
      localStorage.removeItem('cms_session');
      window.dispatchEvent(new CustomEvent('cms:auth:expired', { detail: { authenticated: false, user: null, expiresAt: null, reason: 'shell_validation' } }));
      return null;
    }
    return session;
  } catch (_) {
    localStorage.removeItem('cms_session');
    window.dispatchEvent(new CustomEvent('cms:auth:expired', { detail: { authenticated: false, user: null, expiresAt: null, reason: 'corrupt_session' } }));
    return null;
  }
};

const enforceAuthentication = () => {
  const path = window.location.pathname;
  const requiresAuthentication = protectedRoutes.some(route => path === route || path.startsWith(`${route}/`));
  if (requiresAuthentication && !getValidSession()) {
    navigateToUrl('/cms-root-orchestration/auth');
  }
};

window.addEventListener('single-spa:before-routing-event', enforceAuthentication);
window.addEventListener('storage', enforceAuthentication);
window.addEventListener('cms:auth:expired', enforceAuthentication);

enforceAuthentication();
applications.forEach(registerApplication);
layoutEngine.activate();
start();

console.log('[Shell] Microfrontend orchestration initialized');
