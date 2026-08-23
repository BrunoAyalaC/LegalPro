// railway-service-update.mjs - Cambiar source del servicio a imagen Docker correctamente
const TOKEN = 'rw_Fe26.2**16e7cdcec84ec2d6a88416b57e96fcb532bcb8ebc530aa5c74cb3079a8bea3a2*LH45wXhJCbW6tny1-_as-A*R1HfQ0q0R5_6VEXDbFiDxIrLl-CzyqtE00r82EQaSEi0blzoIZz3MgIQNWLWB_NZEfzk2ugZg7AvgiBppNWjFg*1787515764570*0738394c26dbb361d7e7ae6b7bf81a4d4651a430f267a59d91f9f0d9c10b3714*XyDEsVNQ1y9xllxvR0Ay3NsHl3I7EJHU_RmBUV0UseE';
const API_URL = 'https://backboard.railway.com/graphql/v2';
const SERVICE_NODE = '8fae66f3-c18c-4f4c-a468-715cfef933fa';
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
  const action = process.argv[2] || 'introspect-service-update';

  if (action === 'introspect-service-update') {
    const { data, errors } = await gql(`
      query {
        __type(name: "ServiceUpdateInput") {
          inputFields { name type { name kind ofType { name } } }
        }
      }
    `);
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 300));
    console.log('ServiceUpdateInput:', JSON.stringify(data?.__type?.inputFields || [], null, 1));
  }

  if (action === 'introspect-connect') {
    const { data, errors } = await gql(`
      query {
        __type(name: "ServiceConnectInput") {
          inputFields { name type { name kind ofType { name } } }
        }
      }
    `);
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 300));
    console.log('ServiceConnectInput:', JSON.stringify(data?.__type?.inputFields || [], null, 1));
  }

  if (action === 'service-update-image') {
    const { data, errors } = await gql(`
      mutation ServiceUpdate($id: String!, $input: ServiceUpdateInput!) {
        serviceUpdate(id: $id, input: $input)
      }
    `, {
      id: SERVICE_NODE,
      input: { source: { image: 'brunoayala97/legalpro-node-api:v6.12.4' } }
    });
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 500));
    console.log('ServiceUpdate:', JSON.stringify(data, null, 2));
  }

  if (action === 'service-connect') {
    const serviceId = process.argv[4] || SERVICE_NODE;
    const image = process.argv[3] || 'brunoayala97/legalpro-node-api:v6.12.5';
    const { data, errors } = await gql(`
      mutation ServiceConnect($id: String!, $input: ServiceConnectInput!) {
        serviceConnect(id: $id, input: $input) {
          id
        }
      }
    `, {
      id: serviceId,
      input: { image }
    });
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 500));
    console.log('ServiceConnect:', JSON.stringify(data, null, 2));
  }

  if (action === 'connect-fields') {
    const { data, errors } = await gql(`
      query {
        __type(name: "Mutation") {
          fields {
            name
            args { name type { name kind } }
          }
        }
      }
    `);
    if (errors) console.log('Errors:', JSON.stringify(errors).substring(0, 300));
    const f = (data?.__type?.fields || []).find(x => x.name === 'serviceConnect');
    console.log('serviceConnect args:', JSON.stringify(f?.args || [], null, 1));
  }
}

main().catch(e => console.error('ERROR:', e.message));
