/**
 * Actualiza Source Image en Railway y despliega (sin rebuild).
 * Uso: node tools/railway/set-docker-image.mjs legalpro-frontend brunoayala97/legalpro-frontend:6.3.14
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SERVICE_MAP = {
  'legalpro-frontend': '79c9b626-80a9-4512-9a0a-9b9cfc6507f3',
  'legalpro-node': null, // set if needed
};
const ENV_ID = '2249cb14-3765-45cf-bfbe-49b234a4b3bd';

const serviceName = process.argv[2] || 'legalpro-frontend';
const image = process.argv[3];
if (!image) {
  console.error('Uso: node tools/railway/set-docker-image.mjs <service> <image:tag>');
  process.exit(1);
}

const serviceId = SERVICE_MAP[serviceName];
if (!serviceId) throw new Error(`Servicio desconocido: ${serviceName}`);

const cfg = JSON.parse(readFileSync(join(homedir(), '.railway', 'config.json'), 'utf8'));
const token = process.env.RAILWAY_TOKEN || cfg?.user?.token;
if (!token) throw new Error('Sin RAILWAY_TOKEN');

const gql = async (query, variables) => {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
};

console.log(`Actualizando ${serviceName} -> ${image}`);
await gql(
  `mutation serviceInstanceUpdate($environmentId: String!, $serviceId: String!, $input: ServiceInstanceUpdateInput!) {
    serviceInstanceUpdate(environmentId: $environmentId, serviceId: $serviceId, input: $input)
  }`,
  {
    environmentId: ENV_ID,
    serviceId,
    input: { source: { image } },
  },
);

console.log('Disparando deploy...');
const deploy = await gql(
  `mutation serviceInstanceDeployV2($environmentId: String!, $serviceId: String!) {
    serviceInstanceDeployV2(environmentId: $environmentId, serviceId: $serviceId)
  }`,
  { environmentId: ENV_ID, serviceId },
);
console.log('Deploy ID:', deploy.serviceInstanceDeployV2);
