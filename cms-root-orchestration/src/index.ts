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

const layoutEngine = constructLayoutEngine({ 
  routes, 
  applications, 
  active: true 
});

const protectedRoutes = [
  '/cms-root-orchestration/editorial',
  '/cms-root-orchestration/collab',
  '/cms-root-orchestration/media'
];

const enforceAuthentication = () => {
  const path = window.location.pathname;
  const requiresAuthentication = protectedRoutes.some(route => path === route || path.startsWith(`${route}/`));
  const authenticated = Boolean(localStorage.getItem('cms_session'));

  if (requiresAuthentication && !authenticated) {
    navigateToUrl('/cms-root-orchestration/auth');
  }
};

window.addEventListener('single-spa:before-routing-event', () => {
  enforceAuthentication();
  const container = document.getElementById('single-spa-container');
  if (container) {
    container.style.opacity = '0';
  }
});

enforceAuthentication();

applications.forEach(registerApplication);
layoutEngine.activate();
start();

console.log('[Shell] Microfrontend orchestration initialized');
