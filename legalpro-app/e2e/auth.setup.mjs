import { test as setup } from '@playwright/test';
import { loginViaAPI, USERS } from './helpers/prod-auth.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const authFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth', 'abogado.json');

setup('sesión abogado producción', async ({ page, request }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('legalpro_tour_completed', '1'); } catch { /* ignore */ }
  });
  await loginViaAPI(page, request, USERS.abogado);
  await page.context().storageState({ path: authFile });
});
