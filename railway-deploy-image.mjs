// railway-deploy-image.mjs - Cambia el source del servicio a Docker Hub y deploya
const TOKEN = 'rw_Fe26.2**16e7cdcec84ec2d6a88416b57e96fcb532bcb8ebc530aa5c74cb3079a8bea3a2*LH45wXhJCbW6tny1-_as-A*R1HfQ0q0R5_6VEXDbFiDxIrLl-CzyqtE00r82EQaSEi0blzoIZz3MgIQNWLWB_NZEfzk2ugZg7AvgiBppNWjFg*1787515764570*0738394c26dbb361d7e7ae6b7bf81a4d4651a430f267a59d91f9f0d9c10b3714*XyDEsVNQ1y9xllxvR0Ay3NsHl3I7EJHU_RmBUV0UseE';
const API_URL = 'https://backboard.railway.com/graphql/v2';

const SERVICE_NODE = '8fae66f3-c18c-4f4c-a468-715cfef933fa';
const SERVICE_FRONTEND = '79c9b626-80a9-4512-9a0a-9b9cfc6507f3';
const INSTANCE_NODE = '26ca8ccb-deb1-46c8-888d-093775b67f50';
const IMAGE_NODE = 'brunoayala97/legalpro-node-api:v6.12.4';
const IMAGE_FRONTEND = 'brunoayala97/legalpro-frontend:v6.12.4';
const ENV_ID = '2249cb14-3765-45cf-bfbe-49b234a4b3bd';

async function gql(query, variables = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.substring(0, 500) }; }
  return data;
}

async function main() {
  const action = process.argv[2] || 'introspect-source';

  if (action === 'introspect-source') {
    const { data, errors } = await gql(`
      query {
        __type(name: "ServiceSourceInput") {
          inputFields { name type { name kind ofType { name } } }
        }
      }
    `);
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 300));
    console.log('ServiceSourceInput:', JSON.stringify(data?.__type?.inputFields || [], null, 1));
  }

  if (action === 'introspect-mutations') {
    const { data } = await gql(`
      query {
        __type(name: "Mutation") {
          fields {
            name
            args { name type { name kind } }
            type { name kind }
          }
        }
      }
    `);
    const fields = data?.__type?.fields || [];
    const target = fields.filter(f => f.name.toLowerCase().includes('instance'));
    console.log('Mutations de instancia:');
    target.forEach(f => {
      const args = f.args.map(a => a.name + ': ' + (a.type?.name || a.type?.kind)).join(', ');
      console.log('  ' + f.name + '(' + args + ') -> ' + (f.type?.name || f.type?.kind));
    });
  }

  if (action === 'update-node-image') {
    // Cambiar source del servicio node a la imagen de Docker Hub
    const ENV_ID = '2249cb14-3765-45cf-bfbe-49b234a4b3bd';
    const { data, errors } = await gql(`
      mutation UpdateInstance($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
        serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
      }
    `, {
      serviceId: SERVICE_NODE,
      environmentId: ENV_ID,
      input: {
        source: { image: IMAGE_NODE }
      }
    });
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 500));
    console.log('Update result:', JSON.stringify(data, null, 2));
  }

  if (action === 'redeploy-node') {
    const { data, errors } = await gql(`
      mutation RedeployInstance($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `, { serviceId: SERVICE_NODE, environmentId: ENV_ID });
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 500));
    console.log('Redeploy result:', JSON.stringify(data, null, 2));
  }

  if (action === 'update-frontend-image') {
    const { data, errors } = await gql(`
      mutation UpdateInstance($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
        serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
      }
    `, {
      serviceId: SERVICE_FRONTEND,
      environmentId: ENV_ID,
      input: {
        source: { image: IMAGE_FRONTEND }
      }
    });
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 500));
    console.log('Frontend update:', JSON.stringify(data, null, 2));
  }

  if (action === 'redeploy-frontend') {
    const { data, errors } = await gql(`
      mutation RedeployInstance($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `, { serviceId: SERVICE_FRONTEND, environmentId: ENV_ID });
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 500));
    console.log('Frontend redeploy:', JSON.stringify(data, null, 2));
  }

  if (action === 'deploy-instance') {
    // Disparar deploy de la instancia
    const { data, errors } = await gql(`
      mutation DeployInstance($id: String!) {
        serviceInstanceDeploy(serviceInstanceId: $id) {
          id
        }
      }
    `, { id: INSTANCE_NODE });
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 400));
    console.log('Deploy result:', JSON.stringify(data, null, 2));
  }

  if (action === 'redeploy-instance') {
    const { data, errors } = await gql(`
      mutation RedeployInstance($id: String!) {
        serviceInstanceRedeploy(serviceInstanceId: $id) {
          id
        }
      }
    `, { id: INSTANCE_NODE });
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 400));
    console.log('Redeploy result:', JSON.stringify(data, null, 2));
  }
}

main().catch(e => console.error('ERROR:', e.message));
