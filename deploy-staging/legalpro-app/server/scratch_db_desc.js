import db from './db.js';

async function main() {
  try {
    const expCols = await db.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expedientes'"
    );
    console.log('--- EXPEDIENTES COLUMNS ---');
    console.log(expCols.rows);

    const docCols = await db.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documentos'"
    );
    console.log('--- DOCUMENTOS COLUMNS ---');
    console.log(docCols.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
